import { supabase } from "./supabase"
import { isDemoMode, DEMO_STORAGE_KEY } from "./demo-mode"
import { DEMO_SEED } from "./demo-seed"
import type { ApiKeys, Cliente, CrmState, Nota } from "./types"

// ─── localStorage backend (demo mode) ──────────────────────────────────────
// Estructura idéntica al return de loadAll(): { clientes, apiKeys, notasGlobal, profilesByCliente }.
// Si no hay nada guardado, siembra con DEMO_SEED.
function readDemoState(): CrmState {
  if (typeof window === "undefined") {
    return JSON.parse(JSON.stringify(DEMO_SEED)) as CrmState
  }
  const raw = window.localStorage.getItem(DEMO_STORAGE_KEY)
  if (!raw) {
    const seed = JSON.parse(JSON.stringify(DEMO_SEED)) as CrmState
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(seed))
    return seed
  }
  try {
    return JSON.parse(raw) as CrmState
  } catch {
    const seed = JSON.parse(JSON.stringify(DEMO_SEED)) as CrmState
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(seed))
    return seed
  }
}

function writeDemoState(state: CrmState): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state))
}

// ─── Carga inicial ──────────────────────────────────────────────────────────
// Lee las tablas en paralelo y devuelve el estado del CRM en el shape
// que espera el componente raíz. En demo mode lee de localStorage.
export async function loadAll(): Promise<CrmState | null> {
  if (isDemoMode()) return readDemoState()
  if (!supabase) return null

  const [clientesRes, keysRes, notasRes, profilesRes] = await Promise.all([
    supabase.from("clientes").select("id, data"),
    supabase.from("api_keys").select("cliente_id, data"),
    supabase.from("notas").select("*").order("fecha", { ascending: true }),
    supabase.from("profiles").select("id, cliente_id, role"),
  ])

  const errs = [clientesRes, keysRes, notasRes].filter((r) => r.error)
  if (errs.length) {
    console.error(
      "[db.loadAll] errores:",
      errs.map((r) => r.error),
    )
    return null
  }

  const clientes: Record<string, Cliente> = Object.fromEntries(
    (clientesRes.data || []).map((r) => [r.id, r.data as Cliente]),
  )
  const apiKeys: Record<string, ApiKeys> = Object.fromEntries(
    (keysRes.data || []).map((r) => [r.cliente_id, r.data as ApiKeys]),
  )

  // Filas de Supabase con snake_case → camelCase del cliente.
  type NotaRow = {
    id: string
    cliente_id: string
    autor: "admin" | "cliente"
    texto: string
    fecha: string
    reply_to_id: string | null
  }
  const notasGlobal: Record<string, Nota[]> = {}
  for (const n of ((notasRes.data || []) as NotaRow[])) {
    if (!notasGlobal[n.cliente_id]) notasGlobal[n.cliente_id] = []
    notasGlobal[n.cliente_id].push({
      id: n.id,
      autor: n.autor,
      texto: n.texto,
      fecha: n.fecha,
      replyToId: n.reply_to_id || null,
    })
  }

  type ProfileRow = { id: string; cliente_id: string | null; role: "admin" | "cliente" }
  const profilesByCliente: CrmState["profilesByCliente"] = {}
  for (const p of ((profilesRes.data || []) as ProfileRow[])) {
    if (p.cliente_id) {
      profilesByCliente[p.cliente_id] = { userId: p.id, role: p.role }
    }
  }

  return { clientes, apiKeys, notasGlobal, profilesByCliente }
}

// ─── Mutaciones ─────────────────────────────────────────────────────────────

export async function upsertCliente(id: string, data: Cliente): Promise<void> {
  if (isDemoMode()) {
    const state = readDemoState()
    state.clientes[id] = data
    writeDemoState(state)
    return
  }
  if (!supabase) return
  const { error } = await supabase.from("clientes").upsert({ id, data })
  if (error) console.error("[db.upsertCliente]", error)
}

export async function upsertApiKeys(clienteId: string, data: ApiKeys): Promise<void> {
  if (isDemoMode()) {
    const state = readDemoState()
    state.apiKeys[clienteId] = data
    writeDemoState(state)
    return
  }
  if (!supabase) return
  const { error } = await supabase
    .from("api_keys")
    .upsert({ cliente_id: clienteId, data })
  if (error) console.error("[db.upsertApiKeys]", error)
}

export async function insertNota(clienteId: string, nota: Nota): Promise<void> {
  if (isDemoMode()) {
    const state = readDemoState()
    if (!state.notasGlobal[clienteId]) state.notasGlobal[clienteId] = []
    state.notasGlobal[clienteId].push({
      id: String(nota.id),
      autor: nota.autor,
      texto: nota.texto,
      fecha: nota.fecha,
      replyToId: nota.replyToId ? String(nota.replyToId) : null,
    })
    writeDemoState(state)
    return
  }
  if (!supabase) return
  const { error } = await supabase.from("notas").insert({
    id: String(nota.id),
    cliente_id: clienteId,
    autor: nota.autor,
    texto: nota.texto,
    reply_to_id: nota.replyToId ? String(nota.replyToId) : null,
    fecha: nota.fecha,
  })
  if (error) console.error("[db.insertNota]", error)
}

export async function deleteNota(notaId: string): Promise<void> {
  if (isDemoMode()) {
    const state = readDemoState()
    const targetId = String(notaId)
    for (const cId of Object.keys(state.notasGlobal)) {
      state.notasGlobal[cId] = (state.notasGlobal[cId] || []).filter(
        (n) => String(n.id) !== targetId,
      )
    }
    writeDemoState(state)
    return
  }
  if (!supabase) return
  const { error } = await supabase.from("notas").delete().eq("id", String(notaId))
  if (error) console.error("[db.deleteNota]", error)
}

// ─── API authenticated fetch helper ─────────────────────────────────────────
// En demo mode no hay backend autenticado; los endpoints que requieren
// admin (crear cliente, asignar acceso, etc.) devuelven mocks 200.
export async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  if (isDemoMode()) {
    return new Response(JSON.stringify({ ok: true, demo: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (!supabase) return fetch(url, opts)
  const { data } = await supabase.auth.getSession()
  const accessToken = data?.session?.access_token
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
}
