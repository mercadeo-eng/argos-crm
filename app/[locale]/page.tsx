"use client"

import { useState, useEffect } from "react"
import { loadAll, upsertCliente, upsertApiKeys, insertNota, deleteNota, authFetch } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { isDemoMode, DEMO_PROFILE, DEMO_SESSION } from "@/lib/demo-mode"
import { Brand } from "./_brand"
import { SetupWizard } from "./_setup-wizard"
import { LoginScreen } from "./_components/login-screen"
import { Sidebar } from "./_components/sidebar"
import { DashboardPage } from "./_components/dashboard-page"
import { NuevoClienteModal } from "./_components/nuevo-cliente-modal"
import { ClientePage } from "./_components/cliente-page"
import { PlanificadorPage } from "./_components/planificador-page"
import { PautasPage } from "./_components/pautas-page"
import type { Cliente, ApiKeys, Nota, EstadoCliente, ProfilesByCliente } from "@/lib/types"

type Profile = { id: string; role: "admin" | "cliente"; cliente_id: string | null } | null
type Session = { user: { id: string; email?: string } } | null
type GoogleStatus = { loading: boolean; connected: boolean; email: string | null }
type CrearCliente = {
  id: string
  cliente: Cliente
  email: string
  password: string
}

export default function ArgosCRM() {
  const [page, setPage] = useState("dashboard")
  const [clientes, setClientes] = useState<Record<string, Cliente>>({})
  const [apiKeys, setApiKeys] = useState<Record<string, ApiKeys>>({})
  const [notasGlobal, setNotasGlobal] = useState<Record<string, Nota[]>>({})
  const [profilesByCliente, setProfilesByCliente] = useState<ProfilesByCliente>({})
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState<Session>(null)
  const [profile, setProfile] = useState<Profile>(null)
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ loading: true, connected: false, email: null })
  // Setup status: null = aún no verificado, true = falta config, false = listo.
  // Solo se evalúa cuando no estamos en demo mode y no hay sesión.
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null)
  const [setupOverride, setSetupOverride] = useState(false)

  async function refreshGoogleStatus() {
    try {
      const r = await fetch("/api/google/status")
      const d = await r.json()
      setGoogleStatus({ loading: false, connected: !!d.connected, email: d.email || null })
    } catch {
      setGoogleStatus({ loading: false, connected: false, email: null })
    }
  }

  // ─── Supabase Auth: sesión inicial + listener de cambios ────────────────
  // En demo mode bypassea Supabase y entra como admin mock.
  useEffect(() => {
    if (isDemoMode()) {
      setSession(DEMO_SESSION as Session)
      setAuthReady(true)
      return
    }
    if (!supabase) { setAuthReady(true); return }
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session as Session)
      setAuthReady(true)
    })
    const sub = supabase.auth.onAuthStateChange((_e, sess) => {
      if (!alive) return
      setSession(sess as Session)
      setAuthReady(true)
    })
    return () => { alive = false; sub.data.subscription.unsubscribe() }
  }, [])

  // ─── Health del setup: detecta env vars Supabase + migrations + admin ───
  // Solo corre cuando no estamos en demo y aún no hay sesión activa.
  useEffect(() => {
    if (isDemoMode() || session) { setSetupNeeded(false); return }
    let alive = true
    fetch("/api/setup/health", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        const ready = d.supabaseConfigured && d.migrationsRan && d.hasAdmin
        setSetupNeeded(!ready)
      })
      .catch(() => { if (alive) setSetupNeeded(true) })
    return () => { alive = false }
  }, [session, authReady])

  // ─── Profile del usuario logueado (role + cliente_id) ───────────────────
  useEffect(() => {
    if (isDemoMode()) {
      setProfile(DEMO_PROFILE as Profile)
      return
    }
    if (!session || !supabase) { setProfile(null); return }
    let alive = true
    supabase.from("profiles").select("id, role, cliente_id").eq("id", session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { console.error("[profile load]", error); setProfile(null); return }
        setProfile(data as Profile)
      })
    return () => { alive = false }
  }, [session])

  // ─── Carga inicial de datos cuando hay sesión ───────────────────────────
  useEffect(() => {
    if (!session) {
      setClientes({}); setApiKeys({}); setNotasGlobal({}); setProfilesByCliente({})
      return
    }
    let alive = true
    setLoading(true)
    loadAll().then((data: any) => {
      if (!alive) return
      if (!data) { setLoading(false); return }
      setClientes(data.clientes)
      setApiKeys(data.apiKeys)
      setNotasGlobal(data.notasGlobal)
      setProfilesByCliente(data.profilesByCliente)
      setLoading(false)
    })
    return () => { alive = false }
  }, [session])

  // ─── Google Calendar status + query params de callback ──────────────────
  useEffect(() => {
    refreshGoogleStatus()
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const connected = params.get("google_connected")
    const error = params.get("google_error")
    if (connected || error) {
      window.history.replaceState({}, "", window.location.pathname)
      if (error) alert(`Error conectando Google Calendar: ${decodeURIComponent(error)}`)
    }
  }, [])

  // ─── Auth derivado desde profile ────────────────────────────────────────
  const auth = profile ? { rol: profile.role, clienteSlug: profile.cliente_id } : null

  function handleUpdateApi(cId: string, p: "meta" | "google", v: any) {
    setApiKeys(prev => {
      const next = { ...prev, [cId]: { ...(prev[cId] || { meta: null, google: null }), [p]: v } }
      upsertApiKeys(cId, next[cId])
      return next
    })
  }
  // Crear cliente: API route con service_role crea cliente + auth user + profile
  // Devuelve { ok, error? } para que el modal maneje el flujo de error.
  async function handleCrearCliente(payload: CrearCliente): Promise<{ ok: boolean; error?: string }> {
    try {
      const r = await authFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      const result = await r.json().catch(() => ({}))
      if (!r.ok) return { ok: false, error: result.error || `HTTP ${r.status}` }
      setClientes(prev => ({ ...prev, [payload.id]: payload.cliente }))
      setProfilesByCliente(prev => ({ ...prev, [payload.id]: { userId: result.userId, role: "cliente" } }))
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message || "network_error" }
    }
  }
  function handleUpdateEstado(cId: string, e: EstadoCliente) {
    setClientes(prev => {
      const next = { ...prev, [cId]: { ...prev[cId], estado: e } }
      upsertCliente(cId, next[cId])
      return next
    })
  }
  function handleAgregarNota(cId: string, autor: "admin" | "cliente", texto: string, replyToId?: string | null) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const n: Nota = { id, autor, texto: texto.trim(), fecha: new Date().toISOString(), replyToId: replyToId || null }
    setNotasGlobal(prev => ({ ...prev, [cId]: [...(prev[cId] || []), n] }))
    insertNota(cId, n)
  }
  function handleEliminarNota(cId: string, nId: string) {
    setNotasGlobal(prev => ({ ...prev, [cId]: (prev[cId] || []).filter(n => n.id !== nId) }))
    deleteNota(nId)
  }
  // Eliminar cliente: borra cliente + auth user + profile (cascade) vía API route
  async function handleEliminarCliente(cId: string) {
    try {
      const r = await authFetch(`/api/admin/users/${encodeURIComponent(cId)}`, { method: "DELETE" })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        alert(`No se pudo eliminar: ${e.error || r.status}`)
        return
      }
      setClientes(prev => { const n = { ...prev }; delete n[cId]; return n })
      setApiKeys(prev => { const n = { ...prev }; delete n[cId]; return n })
      setNotasGlobal(prev => { const n = { ...prev }; delete n[cId]; return n })
      setProfilesByCliente(prev => { const n = { ...prev }; delete n[cId]; return n })
      setPage("dashboard")
    } catch (e: any) {
      alert(`Error: ${e?.message || "network_error"}`)
    }
  }
  // Asignar credenciales a un cliente existente sin acceso aún
  async function handleAsignarAcceso(cId: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const r = await authFetch(`/api/admin/users/${encodeURIComponent(cId)}/credentials`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      const result = await r.json().catch(() => ({}))
      if (!r.ok) return { ok: false, error: result.error || `HTTP ${r.status}` }
      setProfilesByCliente(prev => ({ ...prev, [cId]: { userId: result.userId, role: "cliente" } }))
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message || "network_error" }
    }
  }
  // Merge shallow de campos top-level del cliente (calendarId, etc.)
  function handleUpdateCliente(cId: string, fields: Partial<Cliente>) {
    setClientes(prev => {
      const cliente = prev[cId]
      if (!cliente) return prev
      const next = { ...prev, [cId]: { ...cliente, ...fields } }
      upsertCliente(cId, next[cId])
      return next
    })
  }
  function handleUpdateClienteEtapa(cId: string, etapaKey: string, fields: any) {
    setClientes(prev => {
      const cliente = prev[cId]
      if (!cliente) return prev
      const newEtapas = cliente.etapas.map(e =>
        e.etapa === etapaKey ? { ...e, ...fields } : e
      )
      const next = { ...prev, [cId]: { ...cliente, etapas: newEtapas } }
      upsertCliente(cId, next[cId])
      return next
    })
  }
  async function handleLogout() {
    if (supabase) await supabase.auth.signOut()
    setPage("dashboard")
  }

  // Dev-only: forzar el SetupWizard con ?setup=preview (para QA visual sin
  // tener que cambiar env vars).
  if (typeof window !== "undefined" &&
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("setup") === "preview") {
    return (
      <SetupWizard
        onTryDemo={() => { window.location.search = "" }}
        onRefresh={() => window.location.reload()}
      />
    )
  }

  // Loading state: esperando sesión inicial o profile
  if (!authReady || (session && !profile) || (session && loading)) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-sky-400 animate-spin" />
          <span className="text-xs text-zinc-500 tracking-widest uppercase">cargando</span>
        </div>
      </div>
    )
  }

  if (!auth) {
    // En producción sin Supabase configurado o sin admin → wizard.
    // setupOverride permite saltarse el wizard ("Try demo mode instead").
    if (!isDemoMode() && setupNeeded === true && !setupOverride) {
      return (
        <SetupWizard
          onTryDemo={() => setSetupOverride(true)}
          onRefresh={() => window.location.reload()}
        />
      )
    }
    return <LoginScreen />
  }

  if (auth.rol === "cliente") {
    const c = auth.clienteSlug ? clientes[auth.clienteSlug] : null
    if (!c) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <h2 className="text-lg font-semibold text-white mb-2">No encontramos tu cuenta</h2>
            <p className="text-sm text-zinc-400 mb-5">Contacta a tu administrador.</p>
            <button onClick={handleLogout} className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors">Salir</button>
          </div>
        </div>
      )
    }
    if (c.estado === "pausa" || c.estado === "inactivo") {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-3"><span className="text-2xl">🚫</span></div>
            <h2 className="text-lg font-semibold text-white mb-2">Acceso temporalmente deshabilitado</h2>
            <p className="text-sm text-zinc-400 mb-1">Hola <b className="text-zinc-200">{c.nombre}</b>,</p>
            <p className="text-sm text-zinc-400 mb-5">Tu cuenta se encuentra actualmente <b className={c.estado === "pausa" ? "text-amber-300" : "text-red-300"}>{c.estado === "pausa" ? "en pausa" : "inactiva"}</b>. Para más información, contacta a tu administrador.</p>
            <button onClick={handleLogout} className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors">Volver al inicio</button>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-zinc-950" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <Brand />
            <button onClick={handleLogout} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Salir ↩</button>
          </div>
          <ClientePage cliente={c} apiKeys={apiKeys} onUpdateApi={handleUpdateApi}
            esAdmin={false}
            notas={notasGlobal[c.id] || []}
            onAgregarNota={(t: string, rid?: string | null) => handleAgregarNota(c.id, "cliente", t, rid)}
            onEliminarNota={(nId: string) => handleEliminarNota(c.id, nId)} />
        </div>
      </div>
    )
  }

  const activeCliente = page.startsWith("cliente:") ? clientes[page.split(":")[1]] : null

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Sidebar activePage={page} onNavigate={setPage} onLogout={handleLogout} clientes={clientes} onNuevoCliente={() => setShowNuevoCliente(true)} />
      <main className="flex-1 overflow-y-auto p-6">
        {page === "dashboard" && <DashboardPage clientes={clientes} onNavigate={setPage} />}
        {page === "planificador" && (
          <PlanificadorPage
            clientes={clientes}
            googleStatus={googleStatus}
            onRefreshGoogle={refreshGoogleStatus}
            onUpdateEtapa={handleUpdateClienteEtapa}
          />
        )}
        {page === "pautas" && <PautasPage clientes={clientes} apiKeys={apiKeys} />}
        {activeCliente && (
          <ClientePage cliente={activeCliente} apiKeys={apiKeys}
            onUpdateApi={handleUpdateApi} onUpdateEstado={handleUpdateEstado}
            onUpdateCliente={handleUpdateCliente}
            googleConnected={googleStatus.connected}
            esAdmin={true}
            tieneAcceso={!!profilesByCliente[activeCliente.id]}
            onAsignarAcceso={handleAsignarAcceso}
            notas={notasGlobal[activeCliente.id] || []}
            onAgregarNota={(t: string, rid?: string | null) => handleAgregarNota(activeCliente.id, "admin", t, rid)}
            onEliminarNota={(nId: string) => handleEliminarNota(activeCliente.id, nId)}
            onEliminarCliente={handleEliminarCliente} />
        )}
      </main>
      {showNuevoCliente && <NuevoClienteModal onClose={() => setShowNuevoCliente(false)} onCrear={handleCrearCliente} clientesExistentes={clientes} />}
    </div>
  )
}
