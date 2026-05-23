"use client"
import { useState, useMemo, useEffect } from "react"
import { useTranslations, useFormatter } from "next-intl"
import { authFetch } from "@/lib/db"
import { parseISO, fmtDate, fmtISO } from "@/lib/format"
import { driveFolderUrl, deterministicEventId } from "@/lib/drive"
import { suggestDates, loadColor, computeCarga } from "@/lib/planner-helpers"
import {
  stageLabels as ETAPA_LABELS,
  stageIcons as ETAPA_ICONS,
  stageIds as ETAPAS_ORDEN,
  stagesWithDeliverable as ETAPAS_CON_ENTREGABLE,
  stageStatusLabels as ESTADO_ETAPA_LABELS,
} from "@/lib/stages"
import { estadoBadge } from "./atoms"
import type { Cliente, Etapa, EstadoEtapa } from "@/lib/types"

type GoogleStatus = {
  loading: boolean
  connected: boolean
  email: string | null
}

type EditingState = {
  clienteId: string
  etapa: string
  calId: boolean | string
  fecha: string
  estado: EstadoEtapa
  hora: string
}

type OverrideValue = {
  fecha: string
  estado: EstadoEtapa
  hora: string
}

type EtapaUpdatePatch = Partial<{
  fecha: string
  estado: EstadoEtapa
  hora: string
  calId: string
  calCalendarId: string
}>

type AccessibleCalendar = { id?: string; summary?: string; primary?: boolean }
type GoogleEventLite = { eventId: string; date: string; calendarId: string }

type Props = {
  clientes: Record<string, Cliente>
  googleStatus: GoogleStatus
  onRefreshGoogle?: () => void
  onUpdateEtapa?: (clienteId: string, etapaKey: string, patch: EtapaUpdatePatch) => void
}

// ─── PLANIFICADOR ─────────────────────────────────────────────────────────────
export function PlanificadorPage({ clientes, googleStatus, onRefreshGoogle, onUpdateEtapa }: Props) {
  const t = useTranslations("planner")
  const tc = useTranslations("common")
  const format = useFormatter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Record<string, OverrideValue>>>({})
  const [syncing, setSyncing] = useState(false)
  const [dates, setDates] = useState<Record<string, Record<string, string>>>(() => {
    const d: Record<string, Record<string, string>> = {}
    Object.values(clientes).forEach((c) => {
      d[c.id] = {}
      c.etapas.forEach((e) => {
        d[c.id][e.etapa] = e.fecha || ""
      })
    })
    return d
  })

  // Carga "etapa" (verde) calculada desde las etapas con fecha de todos los
  // clientes en el CRM. Recomputa cuando cambian clientes o overrides.
  const busy = useMemo(() => {
    const b: Record<string, number> = {}
    for (const c of Object.values(clientes || {})) {
      for (const e of c.etapas || []) {
        const fechaEfectiva = dates[c.id]?.[e.etapa] || e.fecha
        if (fechaEfectiva) b[fechaEfectiva] = (b[fechaEfectiva] || 0) + 1
      }
    }
    return b
  }, [clientes, dates])

  // ─── Eventos NO-etapa de Google Calendar ────────────────────────────────
  // Fetch masivo: pide a Google todos los eventos del próximo mes en cada
  // calendario asignado a un cliente. Los que NO coinciden con un calId
  // conocido en el CRM son "otros" (yellow en la stacked bar).
  const [googleEvents, setGoogleEvents] = useState<GoogleEventLite[]>([])

  // Set de calIds que el CRM ya reconoce como etapas sincronizadas.
  // Usado para clasificar cada evento de Google como etapa vs. otro.
  const etapaIdsSet = useMemo(() => {
    const s = new Set<string>()
    for (const c of Object.values(clientes || {})) {
      for (const e of c.etapas || []) {
        if (typeof e.calId === "string") s.add(e.calId)
      }
    }
    return s
  }, [clientes])

  // Lista de TODOS los calendarios accesibles para mercadeo@ (owner, writer
  // y reader). Esto captura eventos creados por otros miembros del equipo en:
  //  - el primary de mercadeo@ (vía edición compartida o invitaciones)
  //  - mini-calendarios asignados a clientes
  //  - calendarios compartidos del workspace (incluso de solo lectura,
  //    típico de calendarios del equipo administrados por otra persona).
  const [accessibleCalendars, setAccessibleCalendars] = useState<AccessibleCalendar[]>([])
  useEffect(() => {
    if (!googleStatus.connected) {
      setAccessibleCalendars([])
      return
    }
    let alive = true
    authFetch("/api/google/calendars?access=read")
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d?.calendars)) setAccessibleCalendars(d.calendars)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [googleStatus.connected])

  // Lista única ordenada de calendarIds a consultar.
  const calendarIdsKey = useMemo(() => {
    const ids = new Set<string>(["primary"])
    for (const c of Object.values(clientes || {})) {
      ids.add(c.calendarId || "primary")
    }
    for (const wc of accessibleCalendars) {
      if (wc?.id) ids.add(wc.id)
    }
    return Array.from(ids).sort().join("|")
  }, [clientes, accessibleCalendars])

  useEffect(() => {
    if (!googleStatus.connected || !calendarIdsKey) {
      setGoogleEvents([])
      return
    }
    let alive = true
    const calendarIds = calendarIdsKey.split("|").filter(Boolean)
    const now = new Date()
    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate()).toISOString()
    authFetch("/api/google/calendar/events-bulk", {
      method: "POST",
      body: JSON.stringify({ calendarIds, timeMin, timeMax }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d?.events)) setGoogleEvents(d.events as GoogleEventLite[])
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [googleStatus.connected, calendarIdsKey])

  // Mapa fecha → cantidad de eventos NO-etapa en Google.
  const otrosBusy = useMemo(() => {
    const b: Record<string, number> = {}
    for (const ev of googleEvents) {
      if (!ev?.date || etapaIdsSet.has(ev.eventId)) continue
      b[ev.date] = (b[ev.date] || 0) + 1
    }
    return b
  }, [googleEvents, etapaIdsSet])

  const CARGA = useMemo(() => computeCarga(busy, otrosBusy), [busy, otrosBusy])

  function getData(c: Cliente, e: Etapa): { fecha: string | null; estado: EstadoEtapa; hora: string } {
    const ov = overrides[c.id]?.[e.etapa]
    return {
      fecha: ov?.fecha ?? e.fecha,
      estado: ov?.estado ?? e.estado,
      hora: ov?.hora !== undefined ? ov.hora : (e.hora || ""),
    }
  }
  function getAnchor(cId: string, eK: string): string {
    const orden = ETAPAS_ORDEN
    const idx = orden.indexOf(eK)
    for (let i = idx - 1; i >= 0; i--) {
      const v = dates[cId][orden[i]]
      if (v) return v
    }
    const c = clientes[cId]
    const grilla = c.etapas.find((e) => e.etapa === "grilla")?.fecha
    const cierre = c.etapas.find((e) => e.etapa === "cierre")?.fecha
    if (grilla) {
      const d = parseISO(grilla)
      if (d) {
        d.setDate(d.getDate() - 14)
        return fmtISO(d)
      }
    }
    if (cierre) {
      const d = parseISO(cierre)
      if (d) {
        d.setDate(d.getDate() - 18)
        return fmtISO(d)
      }
    }
    return fmtISO(new Date())
  }
  function countMissing(c: Cliente): number {
    return c.etapas.filter((e) => !e.calId && !dates[c.id][e.etapa]).length
  }
  function startEdit(cId: string, eObj: Etapa, d: { fecha: string | null; estado: EstadoEtapa; hora: string }) {
    setEditing({
      clienteId: cId,
      etapa: eObj.etapa,
      calId: eObj.calId,
      fecha: d.fecha || "",
      estado: d.estado,
      hora: d.hora || "",
    })
  }
  function applyChange(cId: string, e: string, f: string, est: EstadoEtapa, hora: string) {
    setOverrides((prev) => ({ ...prev, [cId]: { ...(prev[cId] || {}), [e]: { fecha: f, estado: est, hora: hora || "" } } }))
    setDates((prev) => ({ ...prev, [cId]: { ...prev[cId], [e]: f } }))
    onUpdateEtapa && onUpdateEtapa(cId, e, { fecha: f, estado: est, hora: hora || "" })
  }
  function saveEdit() {
    if (!editing) return
    applyChange(editing.clienteId, editing.etapa, editing.fecha, editing.estado, editing.hora || "")
    setEditing(null)
  }
  // saveAll: para cada etapa con fecha, crea (POST) o actualiza (PATCH) el
  // evento en Google Calendar. Persiste calId nuevo en el cliente vía parent.
  async function saveAll() {
    if (!googleStatus.connected) {
      window.location.href = "/api/google/auth"
      return
    }
    setSyncing(true)
    let created = 0,
      updated = 0,
      failed = 0,
      linked = 0
    try {
      for (const c of Object.values(clientes)) {
        const targetCalendar = c.calendarId || "primary"

        const etapasSinCalId = c.etapas.filter((e) => {
          const ov2 = overrides[c.id]?.[e.etapa]
          const f = ov2?.fecha ?? e.fecha
          return f && typeof e.calId !== "string"
        })
        let manualMatches: Record<string, string | null> = {}
        if (etapasSinCalId.length > 0) {
          try {
            const r = await authFetch("/api/google/calendar/find-matches", {
              method: "POST",
              body: JSON.stringify({
                calendarId: targetCalendar,
                clienteNombre: c.nombre,
                etapas: etapasSinCalId.map((e) => ({
                  key: e.etapa,
                  label: ETAPA_LABELS[e.etapa],
                })),
              }),
            })
            if (r.ok) manualMatches = await r.json()
          } catch (err) {
            console.error(`[saveAll find-matches] ${c.nombre}:`, err)
          }
        }

        for (const e of c.etapas) {
          const ov = overrides[c.id]?.[e.etapa]
          const fecha = ov?.fecha ?? e.fecha
          const estado = ov?.estado ?? e.estado
          const hora = (ov?.hora !== undefined ? ov.hora : e.hora) || ""
          if (!fecha) continue

          const estadoLabel = ESTADO_ETAPA_LABELS[estado] || estado
          const summary = `${c.nombre} — ${ETAPA_LABELS[e.etapa]} — ${estadoLabel}`
          let calIdStr: string | null = typeof e.calId === "string" ? e.calId : null
          let viaManualMatch = false
          if (!calIdStr && manualMatches[e.etapa]) {
            calIdStr = manualMatches[e.etapa]
            viaManualMatch = true
          }
          const existingCalendar = viaManualMatch ? targetCalendar : (e.calCalendarId || "primary")
          const payloadBase = { summary, date: fecha, hora: hora || null }

          try {
            if (calIdStr) {
              const r = await fetch(`/api/google/calendar/events/${encodeURIComponent(calIdStr)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payloadBase, calendarId: existingCalendar }),
              })
              if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`)
              if (viaManualMatch) linked++
              else updated++
              const fields: EtapaUpdatePatch = { fecha, estado, hora }
              if (viaManualMatch) {
                fields.calId = calIdStr
                fields.calCalendarId = existingCalendar
              }
              onUpdateEtapa && onUpdateEtapa(c.id, e.etapa, fields)
            } else {
              const eventId = deterministicEventId(c.id, e.etapa)
              const r = await fetch(`/api/google/calendar/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payloadBase, calendarId: targetCalendar, eventId }),
              })
              const data = await r.json().catch(() => ({}))
              if (!r.ok || !data.eventId) throw new Error(data.error || `HTTP ${r.status}`)
              if (data.upserted) updated++
              else created++
              onUpdateEtapa &&
                onUpdateEtapa(c.id, e.etapa, {
                  fecha,
                  estado,
                  hora,
                  calId: data.eventId,
                  calCalendarId: data.calendarId || targetCalendar,
                })
            }
          } catch (err) {
            console.error(`[saveAll] ${c.nombre} / ${e.etapa}:`, err)
            failed++
          }
        }
      }
    } finally {
      setSyncing(false)
      setOverrides({})
    }
    const parts: string[] = []
    if (created) parts.push(t("syncCreated", { count: created }))
    if (updated) parts.push(t("syncUpdated", { count: updated }))
    if (linked) parts.push(t("syncLinked", { count: linked }))
    if (failed) parts.push(t("syncFailed", { count: failed }))
    alert(parts.length ? t("syncSummary", { parts: parts.join("\n• ") }) : t("syncNoChanges"))
  }
  async function handleDisconnect() {
    if (!confirm(t("disconnectConfirm"))) return
    try {
      await fetch("/api/google/status", { method: "DELETE" })
    } finally {
      onRefreshGoogle && onRefreshGoogle()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-white">{t("title")}</h2>
        <div className="flex flex-col items-end gap-1">
          {syncing ? (
            <button disabled className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg text-sm font-medium cursor-wait">
              <span className="w-3 h-3 rounded-full border-2 border-zinc-600 border-t-sky-400 animate-spin" />
              {t("syncing")}
            </button>
          ) : googleStatus.loading ? (
            <button disabled className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-500 rounded-lg text-sm font-medium">
              {t("verifyingGoogle")}
            </button>
          ) : googleStatus.connected ? (
            <button onClick={saveAll} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors font-medium">
              📅 {t("syncGoogle")}
            </button>
          ) : (
            <a href="/api/google/auth" className="flex items-center gap-2 px-4 py-2 bg-sky-500/15 border border-sky-500/40 text-sky-300 rounded-lg text-sm hover:bg-sky-500/25 transition-colors font-medium">
              🔌 {t("connectGoogle")}
            </a>
          )}
          {googleStatus.connected && googleStatus.email && (
            <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{t("connectedAs", { email: googleStatus.email })}</span>
              <span className="text-zinc-700">·</span>
              <button onClick={handleDisconnect} className="text-zinc-500 hover:text-red-300 transition-colors">{t("disconnect")}</button>
            </div>
          )}
        </div>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{t("teamLoad")}</h3>
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "#10B981" }} />
              Etapas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "#F59E0B" }} />
              Otros
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          {CARGA.map(({ iso, day, month, etapas, otros, max }) => {
            const total = etapas + otros
            const etapasPct = Math.min((etapas / max) * 100, 100)
            const otrosPct = Math.max(0, Math.min(((etapas + otros) / max) * 100, 100) - etapasPct)
            const numColor = total >= 5 ? "#EF4444" : total >= 3 ? "#F59E0B" : "#10B981"
            const weekday = format.dateTime(parseISO(iso) || new Date(iso), { weekday: "short" })
            const dia = `${weekday} ${day}/${month}`
            return (
              <div key={iso} className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 w-20 flex-shrink-0 capitalize">{dia}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden flex">
                  <div className="h-1.5 transition-all" style={{ width: `${etapasPct}%`, background: "#10B981" }} />
                  <div className="h-1.5 transition-all" style={{ width: `${otrosPct}%`, background: "#F59E0B" }} />
                </div>
                <span className="text-xs font-medium w-6 text-right" style={{ color: numColor }}>{total}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="space-y-3">
        {Object.values(clientes).map((c) => {
          const missing = countMissing(c)
          const isOpen = openId === c.id
          return (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <button onClick={() => setOpenId(isOpen ? null : c.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-zinc-800/50 transition-colors">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: missing > 0 ? "#F59E0B" : "#10B981" }} />
                <span className="text-sm font-medium text-zinc-200 flex-1 text-left">{c.nombre}</span>
                {missing > 0
                  ? <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">{t("missingDates", { count: missing })}</span>
                  : <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">{t("complete")}</span>}
                <span className="text-zinc-600 text-sm">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-zinc-800 p-4 space-y-3">
                  {c.etapas.map((e, i) => {
                    const d = getData(c, e)
                    const isEd = !!editing && editing.clienteId === c.id && editing.etapa === e.etapa
                    if (isEd && editing) {
                      const editAnchor = getAnchor(c.id, e.etapa)
                      const editSuggs = suggestDates(editAnchor, busy)
                      return (
                        <div key={i} className="py-2 px-3 rounded-lg bg-zinc-800/60 border border-sky-500/30">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className="text-base">{ETAPA_ICONS[e.etapa]}</span>
                            <span className="text-sm text-zinc-300 flex-1">{ETAPA_LABELS[e.etapa]}</span>
                            {typeof e.calId === "string" && <span className="text-[10px] text-sky-400">📅 {t("inCalendar")}</span>}
                          </div>
                          <div className="flex items-center gap-2 ml-9 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{t("date")}</span>
                              <input type="date" value={editing.fecha} onChange={(ev) => setEditing({ ...editing, fecha: ev.target.value })}
                                className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500" />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{t("time")}</span>
                              <input type="time" value={editing.hora || ""} onChange={(ev) => setEditing({ ...editing, hora: ev.target.value })}
                                className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500" />
                              {editing.hora && (
                                <button type="button" onClick={() => setEditing({ ...editing, hora: "" })}
                                  title={t("removeTime")}
                                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">×</button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{t("status")}</span>
                              <select value={editing.estado} onChange={(ev) => setEditing({ ...editing, estado: ev.target.value as EstadoEtapa })}
                                className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500">
                                <option value="pendiente">🟤 {t("statusPending")}</option>
                                <option value="en_curso">🔵 {t("statusInProgress")}</option>
                                <option value="listo">🟢 {t("statusReady")}</option>
                                <option value="atrasado">🔴 {t("statusOverdue")}</option>
                              </select>
                            </div>
                            <div className="flex gap-1.5 ml-auto">
                              <button onClick={() => setEditing(null)} className="px-3 py-1 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors">{tc("cancel")}</button>
                              <button onClick={saveEdit} className="px-3 py-1 rounded-lg text-[11px] bg-sky-500 hover:bg-sky-400 text-white font-medium transition-colors">{tc("save")}</button>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-9 mt-2 flex-wrap items-center">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{t("suggestions")}</span>
                            {editSuggs.map((iso) => {
                              const score = busy[iso] || 0
                              const sel = editing.fecha === iso
                              const loadKey: "loadHigh" | "loadMedium" | "loadLow" =
                                score >= 5 ? "loadHigh" : score >= 3 ? "loadMedium" : "loadLow"
                              return (
                                <button key={iso} onClick={() => setEditing({ ...editing, fecha: iso })}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-all ${sel ? "border-sky-500 bg-sky-500/20 text-sky-300" : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"}`}>
                                  ✨ {fmtDate(iso)}<span style={{ color: loadColor(score) }}>{t(loadKey)}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }
                    const ov = overrides[c.id]?.[e.etapa]
                    const inCalendar = typeof e.calId === "string"
                    const pending = !!ov || (!!d.fecha && !inCalendar)
                    const showAbrir = d.estado === "listo" && ETAPAS_CON_ENTREGABLE.has(e.etapa) && !!c.driveFolderId
                    return (
                      <div key={i} className="flex items-center gap-3 py-1 flex-wrap">
                        <span className="text-base">{ETAPA_ICONS[e.etapa]}</span>
                        <span className={`text-sm flex-1 ${d.fecha ? "text-zinc-300" : "text-zinc-400"}`}>{ETAPA_LABELS[e.etapa]}</span>
                        {d.fecha
                          ? <span className="text-sm font-medium text-zinc-300">{fmtDate(d.fecha, d.hora)}</span>
                          : <span className="text-xs text-amber-500">{t("noDate")}</span>}
                        {estadoBadge(d.estado)}
                        {pending && <span className="text-[10px] text-amber-300 flex items-center gap-1">🔄 {t("pending")}</span>}
                        {!pending && inCalendar && <span className="text-[10px] text-sky-400 flex items-center gap-1">✓ {t("inCalendar")}</span>}
                        {showAbrir && (
                          <a href={driveFolderUrl(c.driveFolderId)} target="_blank" rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg text-[11px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-500/50 transition-colors font-medium">
                            ↗ {tc("open")}
                          </a>
                        )}
                        <button onClick={() => startEdit(c.id, e, d)} className="px-2.5 py-1 rounded-lg text-[11px] bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-sky-500/50 hover:text-sky-300 transition-colors">✎ {tc("change")}</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
