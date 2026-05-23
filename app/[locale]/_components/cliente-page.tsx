"use client"
import { useState, useEffect, useRef } from "react"
import { useTranslations, useFormatter } from "next-intl"
import { authFetch } from "@/lib/db"
import {
  extractDriveFolderId,
  driveFolderUrl,
} from "@/lib/drive"
import { fmtDate } from "@/lib/format"
import {
  stageLabels as ETAPA_LABELS,
  stageIcons as ETAPA_ICONS,
} from "@/lib/stages"
import { labels as appLabels } from "@/lib/labels"
import { estadoBadge, Metric } from "./atoms"
import { ApiTab } from "./api"
import { InformeClienteModal } from "./informe-cliente-modal"
import type {
  ApiKeys,
  Cliente,
  EstadoCliente,
  GoogleConnection,
  MetaConnection,
  Nota,
} from "@/lib/types"

type EstadoConfirmState = {
  nuevoEstado: EstadoCliente
  accion: "habilitar" | "bloquear"
}

type CalendarItem = { id: string; summary?: string; primary?: boolean }

type AsignarAccesoResult = { ok: boolean; error?: string }

type Props = {
  cliente: Cliente
  apiKeys: Record<string, ApiKeys>
  esAdmin: boolean
  notas?: Nota[]
  tieneAcceso?: boolean
  googleConnected?: boolean
  onUpdateApi?: (clienteId: string, provider: "meta" | "google", value: MetaConnection | GoogleConnection | null) => void
  onUpdateEstado?: (clienteId: string, nuevoEstado: EstadoCliente) => void
  onAgregarNota?: (text: string, replyToId?: string | null) => void
  onEliminarNota?: (notaId: string) => void
  onEliminarCliente?: (clienteId: string) => void
  onAsignarAcceso?: (clienteId: string, email: string, password: string) => Promise<AsignarAccesoResult>
  onUpdateCliente?: (clienteId: string, patch: Partial<Cliente>) => void
}

// ─── CLIENTE PAGE ─────────────────────────────────────────────────────────────
export function ClientePage(props: Props) {
  const t = useTranslations("client")
  const tc = useTranslations("common")
  const ta = useTranslations("auth")
  const format = useFormatter()
  const {
    cliente,
    apiKeys,
    onUpdateApi,
    onUpdateEstado,
    esAdmin,
  } = props
  const notasMsg: Nota[] = props.notas || []
  const onAgregarNota = props.onAgregarNota
  const onEliminarNota = props.onEliminarNota
  const onEliminarCliente = props.onEliminarCliente
  const tieneAcceso = props.tieneAcceso
  const onAsignarAcceso = props.onAsignarAcceso
  const onUpdateCliente = props.onUpdateCliente
  const googleConnected = props.googleConnected

  const [tab, setTab] = useState<string>("rrss")
  const [redes, setRedes] = useState(cliente.redes)
  const [nuevaNota, setNuevaNota] = useState("")
  const [showInforme, setShowInforme] = useState(false)
  const [showEstadoConfirm, setShowEstadoConfirm] = useState<EstadoConfirmState | null>(null)
  const [replyTo, setReplyTo] = useState<Nota | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAsignarAcceso, setShowAsignarAcceso] = useState(false)
  const [asignarEmail, setAsignarEmail] = useState("")
  const [asignarPassword, setAsignarPassword] = useState("")
  const [asignarError, setAsignarError] = useState("")
  const [asignarLoading, setAsignarLoading] = useState(false)
  // Lista de calendarios disponibles del Google account conectado (solo admin)
  const [calendarsList, setCalendarsList] = useState<CalendarItem[] | null>(null)
  const [calendarsLoading, setCalendarsLoading] = useState(false)
  // Carpeta de Google Drive del cliente (input controlado)
  const [driveInput, setDriveInput] = useState(cliente.driveFolderId ? driveFolderUrl(cliente.driveFolderId) : "")
  const [driveError, setDriveError] = useState("")
  // Edición de credenciales de cliente ya con acceso asignado
  const [accesoEmail, setAccesoEmail] = useState<string | null>(null)
  const [showEditarCred, setShowEditarCred] = useState(false)
  const [editarEmail, setEditarEmail] = useState("")
  const [editarPassword, setEditarPassword] = useState("")
  const [editarError, setEditarError] = useState("")
  const [editarLoading, setEditarLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setRedes(cliente.redes)
    setTab("rrss")
    setShowInforme(false)
    setShowEstadoConfirm(null)
    setNuevaNota("")
    setReplyTo(null)
    setShowDeleteConfirm(false)
    setShowAsignarAcceso(false)
    setAsignarEmail("")
    setAsignarPassword("")
    setAsignarError("")
    setShowEditarCred(false)
    setEditarEmail("")
    setEditarPassword("")
    setEditarError("")
    setAccesoEmail(null)
    setDriveInput(cliente.driveFolderId ? driveFolderUrl(cliente.driveFolderId) : "")
    setDriveError("")
  }, [cliente.id, cliente.driveFolderId, cliente.redes])

  // Fetch del email actual del cliente cuando hay acceso asignado.
  useEffect(() => {
    if (!esAdmin || !tieneAcceso) {
      setAccesoEmail(null)
      return
    }
    let alive = true
    authFetch(`/api/admin/users/${encodeURIComponent(cliente.id)}/credentials`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d && !d.error) setAccesoEmail(d.email || null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [cliente.id, esAdmin, tieneAcceso])

  // Carga la lista de calendarios disponibles (solo admin + Google conectado).
  useEffect(() => {
    if (!esAdmin || !googleConnected) {
      setCalendarsList(null)
      return
    }
    if (calendarsList !== null) return
    let alive = true
    setCalendarsLoading(true)
    authFetch("/api/google/calendars")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d.calendars) setCalendarsList(d.calendars)
        else setCalendarsList([])
      })
      .catch(() => {
        if (alive) setCalendarsList([])
      })
      .finally(() => {
        if (alive) setCalendarsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [esAdmin, googleConnected, calendarsList])

  const clienteApi: ApiKeys = (apiKeys && apiKeys[cliente.id]) || { meta: null, google: null }
  type TabItem = { id: string; label: string; icon: string }
  const tabs: TabItem[] = [
    { id: "rrss", label: t("tabSocial"), icon: "📱" },
    { id: "pautas", label: appLabels.metricsModule ?? t("tabMetrics"), icon: "📊" },
    ...(esAdmin ? [{ id: "api", label: "API", icon: "🔌" }] : []),
    ...(cliente.tieneLeads ? [{ id: "leads", label: t("tabLeads"), icon: "👥" }] : []),
  ]

  function updateRed(i: number, estado: string) {
    setRedes(redes.map((r, idx) => (idx === i ? { ...r, estado } : r)))
  }
  function handleCambioEstado(nuevoEstado: EstadoCliente) {
    if (nuevoEstado === cliente.estado) return
    const permiten: EstadoCliente[] = ["activo", "revision"]
    const accAct = permiten.includes(cliente.estado)
    const accNew = permiten.includes(nuevoEstado)
    if (accAct !== accNew) {
      setShowEstadoConfirm({ nuevoEstado, accion: accNew ? "habilitar" : "bloquear" })
      return
    }
    onUpdateEstado && onUpdateEstado(cliente.id, nuevoEstado)
  }
  function confirmarCambioEstado() {
    if (!showEstadoConfirm) return
    onUpdateEstado && onUpdateEstado(cliente.id, showEstadoConfirm.nuevoEstado)
    setShowEstadoConfirm(null)
  }
  function enviarNota() {
    const text = nuevaNota.trim()
    if (!text || !onAgregarNota) return
    onAgregarNota(text, replyTo?.id ?? null)
    setNuevaNota("")
    setReplyTo(null)
  }
  function confirmarEliminar() {
    if (onEliminarCliente) onEliminarCliente(cliente.id)
  }
  async function submitAsignarAcceso() {
    if (!asignarEmail || !asignarPassword) {
      setAsignarError("Email y contraseña son requeridos")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asignarEmail)) {
      setAsignarError("Email inválido")
      return
    }
    if (asignarPassword.length < 6) {
      setAsignarError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    if (!onAsignarAcceso) return
    setAsignarLoading(true)
    setAsignarError("")
    try {
      const r = await onAsignarAcceso(cliente.id, asignarEmail.trim(), asignarPassword)
      if (!r?.ok) {
        setAsignarError(r?.error || "No se pudo asignar el acceso")
        return
      }
      alert(
        `Credenciales asignadas a ${cliente.nombre}:\n\nEmail: ${asignarEmail}\nContraseña: ${asignarPassword}\n\nGuárdalas y compártelas con el cliente.`,
      )
      setShowAsignarAcceso(false)
      setAsignarEmail("")
      setAsignarPassword("")
    } finally {
      setAsignarLoading(false)
    }
  }

  function saveDriveFolder() {
    const id = extractDriveFolderId(driveInput)
    if (driveInput.trim() && !id) {
      setDriveError("No se reconoce el ID/URL. Pega la URL de la carpeta tal cual la copias de Drive.")
      return
    }
    setDriveError("")
    onUpdateCliente && onUpdateCliente(cliente.id, { driveFolderId: id || null })
  }
  function clearDriveFolder() {
    setDriveInput("")
    setDriveError("")
    onUpdateCliente && onUpdateCliente(cliente.id, { driveFolderId: null })
  }

  function openEditarCred() {
    setEditarEmail(accesoEmail || "")
    setEditarPassword("")
    setEditarError("")
    setShowEditarCred(true)
  }

  async function submitEditarCred() {
    const emailNuevo = editarEmail.trim()
    const emailCambia = !!emailNuevo && emailNuevo !== accesoEmail
    const passwordCambia = !!editarPassword
    if (!emailCambia && !passwordCambia) {
      setEditarError("Cambia el email o ingresa una contraseña nueva")
      return
    }
    if (emailCambia && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNuevo)) {
      setEditarError("Email inválido")
      return
    }
    if (passwordCambia && editarPassword.length < 6) {
      setEditarError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    setEditarLoading(true)
    setEditarError("")
    try {
      const body: { email?: string; password?: string } = {}
      if (emailCambia) body.email = emailNuevo
      if (passwordCambia) body.password = editarPassword
      const r = await authFetch(`/api/admin/users/${encodeURIComponent(cliente.id)}/credentials`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      const result = await r.json().catch(() => ({}))
      if (!r.ok) {
        setEditarError(result.error || `HTTP ${r.status}`)
        return
      }
      if (emailCambia) setAccesoEmail(emailNuevo)
      const lines: string[] = []
      if (emailCambia) lines.push(`Email: ${emailNuevo}`)
      if (passwordCambia) lines.push(`Contraseña: ${editarPassword}`)
      alert(`Credenciales actualizadas:\n\n${lines.join("\n")}\n\nGuárdalas y compártelas con el cliente.`)
      setShowEditarCred(false)
      setEditarPassword("")
    } finally {
      setEditarLoading(false)
    }
  }

  const cycleLabel: Record<string, string> = {
    mensual: t("cycleMonthly"),
    bimestral: t("cycleBimonthly"),
    trimestral: t("cycleQuarterly"),
  }
  const nextStage = cliente.etapas.find((x) => x.fecha && x.estado !== "listo")

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-3 h-3 rounded-full" style={{ background: cliente.color }} />
            <h2 className="text-xl font-semibold text-white">{cliente.nombre}</h2>
            {!esAdmin && estadoBadge(cliente.estado)}
          </div>
          <p className="text-sm text-zinc-500 mt-0.5 ml-5">{cliente.industria} · {cycleLabel[cliente.ciclo] || cliente.ciclo}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {esAdmin && (
            <select defaultValue={cliente.ciclo} className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
              <option value="mensual">{t("cycleMonthly")}</option><option value="bimestral">{t("cycleBimonthly")}</option><option value="trimestral">{t("cycleQuarterly")}</option>
            </select>
          )}
          {esAdmin && (
            <select value={cliente.estado} onChange={(e) => handleCambioEstado(e.target.value as EstadoCliente)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
              <option value="activo">🟢 {t("statusActive")}</option>
              <option value="revision">🔵 {t("statusReview")}</option>
              <option value="pausa">🟡 {t("statusPaused")}</option>
              <option value="inactivo">🔴 {t("statusInactive")}</option>
            </select>
          )}
        </div>
      </div>

      {(cliente.estado === "pausa" || cliente.estado === "inactivo") && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2.5">
          <span className="text-base">🚫</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-red-300">{t("accessBlockedTitle")}</p>
            <p className="text-[11px] text-red-300/70 mt-0.5">
              {cliente.estado === "pausa" ? t("accessBlockedPaused") : t("accessBlockedInactive")}
            </p>
          </div>
        </div>
      )}

      {esAdmin && !tieneAcceso && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5">
          <span className="text-base">🔒</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-300">{t("noCredentialsTitle")}</p>
            <p className="text-[11px] text-amber-300/70 mt-0.5">{t("noCredentialsBody")}</p>
          </div>
          <button onClick={() => setShowAsignarAcceso(true)}
            className="px-3 py-1.5 rounded-lg text-xs bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 transition-colors font-medium whitespace-nowrap">
            {t("assignAccess")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label={t("metricNoDate")} value={cliente.etapas.filter((e) => !e.fecha && !e.calId).length} sub={t("metricStages")} valueColor={cliente.etapas.filter((e) => !e.fecha && !e.calId).length > 0 ? "text-amber-400" : "text-white"} />
        <Metric label={t("metricWithDate")} value={cliente.etapas.filter((e) => e.fecha || e.calId).length} sub={t("metricInCalendar")} />
        <Metric label={t("metricCycle")} value={cycleLabel[cliente.ciclo] || cliente.ciclo} />
        <Metric label={t("metricNextDelivery")} value={nextStage ? fmtDate(nextStage.fecha, nextStage.hora) : "—"} sub={nextStage ? (ETAPA_LABELS[nextStage.etapa] || "—") : "—"} />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">{t("cycleStagesTitle")}</h3>
        <div className="space-y-1">
          {cliente.etapas.map((e, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-zinc-800 last:border-0 flex-wrap">
              <span className="text-base w-6">{ETAPA_ICONS[e.etapa]}</span>
              <span className="text-sm text-zinc-200 flex-1">{ETAPA_LABELS[e.etapa]}</span>
              {e.fecha ? <span className="text-xs text-zinc-400">{fmtDate(e.fecha, e.hora)}</span> : <span className="text-xs text-amber-500">{t("noDate")}</span>}
              {e.calId && <span className="text-[10px] text-sky-400">📅 {t("calShort")}</span>}
              {estadoBadge(e.estado)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-b border-zinc-800 pb-0 overflow-x-auto">
        {tabs.map((ti) => (
          <button key={ti.id} onClick={() => setTab(ti.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === ti.id ? "border-sky-500 text-sky-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
            {ti.icon} {ti.label}
          </button>
        ))}
      </div>

      {tab === "rrss" && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">{t("tabSocial")}</h3>
            <div className="space-y-3">
              {redes.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xl">
                    {r.plataforma === "Instagram" ? "📷" : r.plataforma === "Facebook" ? "👤" : r.plataforma === "TikTok" ? "🎵" : r.plataforma === "LinkedIn" ? "💼" : "▶️"}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-200">{r.plataforma}</p>
                    <p className="text-xs text-zinc-500">{t("lastPost", { date: r.ultima })}</p>
                  </div>
                  {esAdmin ? (
                    <select value={r.estado} onChange={(e) => updateRed(i, e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none">
                      <option value="activo">🟢 {t("statusActive")}</option>
                      <option value="pausado">🟡 {t("socialStatusPaused")}</option>
                      <option value="revision">🔵 {t("socialStatusReview")}</option>
                      <option value="inactivo">🔴 {t("statusInactive")}</option>
                    </select>
                  ) : (
                    estadoBadge(r.estado)
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{t("notesTitle")}</h3>
              <span className="text-[10px] text-zinc-600">{t("notesCount", { count: notasMsg.length })}</span>
            </div>
            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {notasMsg.length === 0 && (
                <div className="text-center py-8 text-zinc-600">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-xs">{t("noNotes")} {esAdmin ? t("noNotesAdmin") : t("noNotesClient")}</p>
                </div>
              )}
              {notasMsg.map((n) => {
                const esAA = n.autor === "admin"
                const fechaFmt = format.dateTime(new Date(n.fecha), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                const parent = n.replyToId ? notasMsg.find((p) => p.id === n.replyToId) : null
                return (
                  <div key={n.id} className={`flex gap-2 group ${esAA ? "flex-row-reverse" : ""}`}>
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${esAA ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"}`}>
                      {esAA ? "A" : cliente.nombre.charAt(0)}
                    </div>
                    <div className={`flex-1 max-w-[80%] flex flex-col ${esAA ? "items-end" : "items-start"}`}>
                      <div className={`relative rounded-2xl px-3 py-2 ${esAA ? "bg-sky-500/15 border border-sky-500/25" : "bg-emerald-500/15 border border-emerald-500/25"}`}>
                        {parent && (
                          <div className={`text-[10px] mb-1.5 pl-2 border-l-2 ${esAA ? "border-sky-500/40" : "border-emerald-500/40"}`}>
                            <span className="font-medium text-zinc-400">↳ {parent.autor === "admin" ? t("adminAuthor") : cliente.nombre}:</span>{" "}
                            <span className="italic text-zinc-500">{parent.texto.length > 80 ? parent.texto.slice(0, 80) + "…" : parent.texto}</span>
                          </div>
                        )}
                        <p className="text-sm text-zinc-100 whitespace-pre-wrap break-words">{n.texto}</p>
                        {esAdmin && (
                          <button onClick={() => onEliminarNota && onEliminarNota(n.id)}
                            title={t("deleteNote")}
                            className={`absolute -top-1.5 ${esAA ? "-left-1.5" : "-right-1.5"} w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-500 hover:bg-red-500 hover:text-white hover:border-red-500 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all`}>
                            ✕
                          </button>
                        )}
                      </div>
                      <div className={`flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-500 ${esAA ? "flex-row-reverse" : ""}`}>
                        <span className="font-medium">{esAA ? t("adminAuthor") : cliente.nombre}</span>
                        <span>·</span>
                        <span>{fechaFmt}</span>
                        {esAdmin && !esAA && (
                          <>
                            <span>·</span>
                            <button onClick={() => { setReplyTo(n); setTimeout(() => textareaRef.current?.focus(), 0) }}
                              className="text-sky-400 hover:text-sky-300 transition-colors font-medium">
                              ↩ {t("reply")}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="pt-3 border-t border-zinc-800">
              {replyTo && (
                <div className="mb-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/25">
                  <span className="text-sky-400 text-xs mt-0.5">↩</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-sky-300 font-medium">{t("replyingTo", { name: cliente.nombre })}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{replyTo.texto}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} title={t("cancelReply")}
                    className="text-zinc-500 hover:text-zinc-300 text-xs leading-none">✕</button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea ref={textareaRef} value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarNota() } }}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-zinc-200 resize-none focus:outline-none focus:border-sky-500 placeholder-zinc-600"
                  rows={2}
                  placeholder={replyTo ? t("replyPlaceholder") : (esAdmin ? t("noteAdminPlaceholder") : t("noteClientPlaceholder"))} />
                <button onClick={enviarNota} disabled={!nuevaNota.trim()}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${nuevaNota.trim() ? (esAdmin ? "bg-sky-500 hover:bg-sky-400 text-white" : "bg-emerald-500 hover:bg-emerald-400 text-white") : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}>
                  {t("publish")}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 mt-2">
              {esAdmin ? t("notesHintAdmin") : t("notesHintClient")}
            </p>
          </div>
        </div>
      )}

      {tab === "pautas" && (
        <div className="space-y-4">
          {!cliente.pautas ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
              <p className="text-zinc-500 text-sm">{t("noActiveAds")}</p>
              <button className="mt-3 px-4 py-2 bg-sky-500/20 border border-sky-500/30 text-sky-300 rounded-lg text-sm hover:bg-sky-500/30 transition-colors">{t("configureAds")} ↗</button>
            </div>
          ) : (
            <>
              {cliente.pautas.meta && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Meta Ads</h3>
                    <span className="text-[10px] text-zinc-600">{t("realtimeDataOnConnect")}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {([
                      [t("metricReach"), cliente.pautas.meta.alcance?.toLocaleString()],
                      ["CTR", `${cliente.pautas.meta.ctr}%`],
                      [t("metricCost"), `$${cliente.pautas.meta.costo}`],
                      [t("metricCostPerResult"), `$${cliente.pautas.meta.cpr}`],
                      ["ROAS", cliente.pautas.meta.roas ? `${cliente.pautas.meta.roas}x` : "—"],
                      [t("metricStatusLabel"), `🟢 ${t("metricActive")}`],
                    ] as Array<[string, string | number | undefined]>).map(([l, v]) => (
                      <div key={l} className="bg-zinc-800 rounded-xl p-3">
                        <p className="text-[10px] text-zinc-500 mb-1">{l}</p>
                        <p className="text-base font-semibold text-white">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {cliente.pautas.google && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">Google Ads</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {([
                      [t("metricReach"), cliente.pautas.google.alcance?.toLocaleString()],
                      ["CTR", `${cliente.pautas.google.ctr}%`],
                      [t("metricCost"), `$${cliente.pautas.google.costo}`],
                      [t("metricConversions"), cliente.pautas.google.conversiones],
                    ] as Array<[string, string | number | undefined]>).map(([l, v]) => (
                      <div key={l} className="bg-zinc-800 rounded-xl p-3">
                        <p className="text-[10px] text-zinc-500 mb-1">{l}</p>
                        <p className="text-base font-semibold text-white">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setShowInforme(true)} className="w-full py-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm hover:bg-emerald-500/30 transition-colors">
                {t("generateReport")} ↗
              </button>
            </>
          )}
        </div>
      )}

      {tab === "api" && (
        <ApiTab apiData={clienteApi} onUpdate={(p, v) => onUpdateApi && onUpdateApi(cliente.id, p, v)} />
      )}

      {tab === "leads" && cliente.leads && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label={t("leadsCampaign")} value={cliente.leads.total} sub="Meta Ads" />
            <Metric label={t("leadsReferred")} value={cliente.leads.referidos} sub={t("leadsNoCost")} />
            <Metric label={t("leadsInvestmentLabel")} value={`$${cliente.leads.inversion}`} sub={t("leadsCampaignSub")} />
            <Metric label={t("leadsRoi")} value={`${cliente.leads.roi}%`} sub={t("leadsProfit", { amount: cliente.leads.ganancia })} valueColor="text-emerald-400" />
          </div>
          {process.env.NEXT_PUBLIC_LEADS_EXTERNAL_URL && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-zinc-400 text-sm mb-3">{t("leadsPipelineAvailable")}</p>
              <a href={process.env.NEXT_PUBLIC_LEADS_EXTERNAL_URL} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500/20 border border-sky-500/30 text-sky-300 rounded-lg text-sm hover:bg-sky-500/30 transition-colors">
                {t("leadsExternalCta")} ↗
              </a>
              <p className="text-xs text-zinc-600 mt-3">{t("leadsPipelineFuture")}</p>
            </div>
          )}
        </div>
      )}

      {esAdmin && googleConnected && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mt-8">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">{t("calendarTitle")}</h3>
          <p className="text-xs text-zinc-500 mb-3">{t("calendarBody", { name: cliente.nombre })}</p>
          {calendarsLoading ? (
            <div className="text-xs text-zinc-500">{t("calendarLoading")}</div>
          ) : !calendarsList?.length ? (
            <div className="text-xs text-amber-300">{t("calendarNone")}</div>
          ) : (
            <select
              value={cliente.calendarId || "primary"}
              onChange={(e) => onUpdateCliente && onUpdateCliente(cliente.id, { calendarId: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500">
              {calendarsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}{c.primary ? `  ${t("calendarPrimary")}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {esAdmin && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mt-8">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">{t("driveTitle")}</h3>
          <p className="text-xs text-zinc-500 mb-3">{t("driveBody", { name: cliente.nombre })}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={driveInput}
              onChange={(ev) => { setDriveInput(ev.target.value); setDriveError("") }}
              onBlur={() => {
                const id = extractDriveFolderId(driveInput)
                if (id && id !== cliente.driveFolderId) saveDriveFolder()
                else if (!driveInput.trim() && cliente.driveFolderId) clearDriveFolder()
              }}
              placeholder="https://drive.google.com/drive/folders/..."
              className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 placeholder-zinc-600 font-mono" />
            {cliente.driveFolderId && (
              <a href={driveFolderUrl(cliente.driveFolderId)} target="_blank" rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-sky-500/50 hover:text-sky-300 transition-colors whitespace-nowrap">
                ↗ {tc("open")}
              </a>
            )}
          </div>
          {driveError && <p className="text-[11px] text-red-400 mt-2">{driveError}</p>}
          {cliente.driveFolderId && (
            <p className="text-[10px] text-zinc-600 mt-2">{t("driveId", { id: cliente.driveFolderId })}</p>
          )}
        </div>
      )}

      {esAdmin && tieneAcceso && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mt-8">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">{t("accessSectionTitle")}</h3>
          <p className="text-xs text-zinc-500 mb-3">{t("accessSectionBody", { name: cliente.nombre })}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{tc("email")}</div>
              <div className="text-sm text-zinc-200 font-mono truncate">{accesoEmail || "—"}</div>
            </div>
            <button onClick={openEditarCred}
              className="px-3 py-2 rounded-lg text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-sky-500/50 hover:text-sky-300 transition-colors font-medium whitespace-nowrap">
              ✎ {t("editCredentials")}
            </button>
          </div>
        </div>
      )}

      {esAdmin && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 mt-8">
          <h3 className="text-xs font-semibold text-red-300 uppercase tracking-widest mb-1">{t("dangerZoneTitle")}</h3>
          <p className="text-xs text-zinc-500 mb-3">{t("dangerZoneBody")}</p>
          <button onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-1.5 rounded-lg text-xs bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 hover:border-red-500/50 transition-colors font-medium">
            🗑 {t("deleteAccount", { name: cliente.nombre })}
          </button>
        </div>
      )}

      {showInforme && <InformeClienteModal cliente={cliente} onClose={() => setShowInforme(false)} />}

      {showEstadoConfirm && (() => {
        const statusMap: Record<EstadoCliente, string> = {
          pausa: t("statusPaused"),
          inactivo: t("statusInactive"),
          activo: t("statusActive"),
          revision: t("statusReview"),
        }
        const newStatusLabel = statusMap[showEstadoConfirm.nuevoEstado] || showEstadoConfirm.nuevoEstado
        const isBlock = showEstadoConfirm.accion === "bloquear"
        return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{isBlock ? "🚫" : "✅"}</span>
              <h3 className="text-base font-semibold text-white">{isBlock ? t("estadoConfirmTitleBlock") : t("estadoConfirmTitleRestore")}</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              {isBlock
                ? t("estadoConfirmBodyBlock", { name: cliente.nombre, newStatus: newStatusLabel })
                : t("estadoConfirmBodyRestore", { name: cliente.nombre, newStatus: newStatusLabel })}
            </p>
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 mb-5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between"><span className="text-zinc-500">{t("estadoCurrentLabel")}</span><span>{estadoBadge(cliente.estado)}</span></div>
              <div className="flex items-center justify-between"><span className="text-zinc-500">{t("estadoNewLabel")}</span><span>{estadoBadge(showEstadoConfirm.nuevoEstado)}</span></div>
              <div className="flex items-center justify-between pt-1.5 border-t border-zinc-700">
                <span className="text-zinc-500">{t("estadoAccessLabel")}</span>
                <span className={isBlock ? "text-red-300 font-medium" : "text-emerald-300 font-medium"}>{isBlock ? t("estadoWillBlock") : t("estadoWillRestore")}</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEstadoConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">{tc("cancel")}</button>
              <button onClick={confirmarCambioEstado} className={`px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors ${isBlock ? "bg-red-500 hover:bg-red-400" : "bg-emerald-500 hover:bg-emerald-400"}`}>
                {isBlock ? t("estadoConfirmBlock") : t("estadoConfirmRestore")}
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {showAsignarAcceso && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🔑</span>
              <h3 className="text-base font-semibold text-white">{t("assignTitle", { name: cliente.nombre })}</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">{t("assignBody")}</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">{tc("email")}</label>
                <input type="email" value={asignarEmail}
                  onChange={(e) => { setAsignarEmail(e.target.value); setAsignarError("") }}
                  placeholder={t("assignEmailPlaceholder")} autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 placeholder-zinc-600" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">{ta("password")}</label>
                <div className="flex gap-2">
                  <input type="text" value={asignarPassword}
                    onChange={(e) => { setAsignarPassword(e.target.value); setAsignarError("") }}
                    placeholder={t("assignPasswordPlaceholder")}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 placeholder-zinc-600 font-mono" />
                  <button onClick={() => {
                    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
                    let p = ""
                    for (let i = 0; i < 10; i++) p += chars.charAt(Math.floor(Math.random() * chars.length))
                    setAsignarPassword(p); setAsignarError("")
                  }} className="px-3 py-2 rounded-lg text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-sky-500/50 hover:text-sky-300 transition-colors whitespace-nowrap">
                    {t("assignGenerate")}
                  </button>
                </div>
              </div>
              {asignarError && <p className="text-[11px] text-red-400">{asignarError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAsignarAcceso(false)} disabled={asignarLoading}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 transition-colors">
                {tc("cancel")}
              </button>
              <button onClick={submitAsignarAcceso} disabled={asignarLoading}
                className="px-4 py-2 rounded-lg text-sm bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium transition-colors">
                {asignarLoading ? t("assignSubmitting") : t("assignAccess")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditarCred && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">✎</span>
              <h3 className="text-base font-semibold text-white">{t("editCredTitle", { name: cliente.nombre })}</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">{t("editCredBody")}</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">{tc("email")}</label>
                <input type="email" value={editarEmail}
                  onChange={(e) => { setEditarEmail(e.target.value); setEditarError("") }}
                  placeholder={t("assignEmailPlaceholder")} autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 placeholder-zinc-600" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">{t("editCredNewPasswordLabel")} <span className="text-zinc-600">{t("editCredOptional")}</span></label>
                <div className="flex gap-2">
                  <input type="text" value={editarPassword}
                    onChange={(e) => { setEditarPassword(e.target.value); setEditarError("") }}
                    placeholder={t("editCredPasswordPlaceholder")}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 placeholder-zinc-600 font-mono" />
                  <button onClick={() => {
                    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
                    let p = ""
                    for (let i = 0; i < 10; i++) p += chars.charAt(Math.floor(Math.random() * chars.length))
                    setEditarPassword(p); setEditarError("")
                  }} className="px-3 py-2 rounded-lg text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-sky-500/50 hover:text-sky-300 transition-colors whitespace-nowrap">
                    {t("assignGenerate")}
                  </button>
                </div>
              </div>
              {editarError && <p className="text-[11px] text-red-400">{editarError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEditarCred(false)} disabled={editarLoading}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 transition-colors">
                {tc("cancel")}
              </button>
              <button onClick={submitEditarCred} disabled={editarLoading}
                className="px-4 py-2 rounded-lg text-sm bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium transition-colors">
                {editarLoading ? t("editCredSaving") : t("editCredSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">⚠</span>
              <h3 className="text-base font-semibold text-white">{t("deleteAccount", { name: cliente.nombre })}</h3>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
              <p className="text-xs text-red-300 leading-relaxed font-medium">{t("deleteConfirmIrreversible")}</p>
              <ul className="text-[11px] text-red-300/80 mt-1.5 space-y-0.5">
                <li>· {t("deleteConfirmItem1")}</li>
                <li>· {t("deleteConfirmItem2")}</li>
                <li>· {t("deleteConfirmItem3")}</li>
                <li>· {t("deleteConfirmItem4")}</li>
                <li>· {t("deleteConfirmItem5")}</li>
              </ul>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                {tc("cancel")}
              </button>
              <button onClick={confirmarEliminar}
                className="px-4 py-2 rounded-lg text-sm bg-red-500 hover:bg-red-400 text-white font-medium transition-colors">
                {t("deleteConfirmCta")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
