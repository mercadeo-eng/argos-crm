"use client"
import { useState } from "react"
import { HISTORICO } from "@/lib/historico"
import type { Cliente, HistoricoEntry, HistoricoMeta } from "@/lib/types"

const MESES = ["Dic", "Ene", "Feb", "Mar", "Abr", "May"] as const
type RangoKey = "0-5" | "3-5" | "5-5" | "0-2"

type EntryWithMeta = HistoricoEntry & { meta: NonNullable<HistoricoEntry["meta"]> }
type EntryWithGoogle = HistoricoEntry & { google: NonNullable<HistoricoEntry["google"]> }
type EntryWithMetaRoas = EntryWithMeta & { meta: HistoricoMeta & { roas: number } }

type Recomendacion = {
  tipo: "alerta" | "exito" | "info"
  texto: string
}

// Subset numérico de HistoricoMeta usado por trend(); todos los campos son
// opcionales en producción real (la integración puede no devolverlos).
type MetaTrendKey = keyof Pick<HistoricoMeta, "alcance" | "ctr" | "cpr" | "interacciones">

type Props = {
  cliente: Cliente
  onClose: () => void
}

// ─── INFORME CLIENTE ──────────────────────────────────────────────────────────
export function InformeClienteModal({ cliente, onClose }: Props) {
  const [rangoKey, setRangoKey] = useState<RangoKey>("0-5")
  const [from, to] = rangoKey.split("-").map(Number)
  const mesesActivos = MESES.slice(from, to + 1)
  const idxActivos = mesesActivos.map((m) => MESES.indexOf(m as (typeof MESES)[number]))
  const hist: HistoricoEntry[] = HISTORICO[cliente.id] || []
  const slice = idxActivos.map((i) => hist[i]).filter(Boolean)

  if (slice.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3"><span className="text-2xl">📊</span></div>
          <h2 className="text-lg font-semibold text-zinc-900 mb-2">Sin datos históricos</h2>
          <p className="text-sm text-zinc-600 mb-5">Aún no hay métricas registradas para <b>{cliente.nombre}</b> en este período. Conecta Meta o Google Ads desde la pestaña <b>API</b> para empezar a recolectar datos.</p>
          <button onClick={onClose} className="px-5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-sm font-medium transition-colors">Cerrar</button>
        </div>
      </div>
    )
  }

  const metaData: EntryWithMeta[] = slice.filter((s): s is EntryWithMeta => !!s.meta)
  const googleData: EntryWithGoogle[] = slice.filter((s): s is EntryWithGoogle => !!s.google)
  const metaInv = metaData.reduce((a, s) => a + s.meta.costo, 0)
  const googleInv = googleData.reduce((a, s) => a + (s.google.costo || 0), 0)
  const totalInv = metaInv + googleInv
  const totalAlcance =
    metaData.reduce((a, s) => a + (s.meta.alcance || 0), 0) +
    googleData.reduce((a, s) => a + (s.google.alcance || 0), 0)
  const totalImpresiones =
    metaData.reduce((a, s) => a + (s.meta.impresiones || 0), 0) +
    googleData.reduce((a, s) => a + (s.google.impresiones || 0), 0)
  const totalInteracciones = metaData.reduce((a, s) => a + (s.meta.interacciones || 0), 0)
  const totalVisualizaciones = googleData.reduce((a, s) => a + (s.google.visualizaciones || 0), 0)
  const totalConversiones = googleData.reduce((a, s) => a + (s.google.conversiones || 0), 0)
  const segInicial = metaData.length ? metaData[0].meta.seguidores || 0 : 0
  const segFinal = metaData.length ? metaData[metaData.length - 1].meta.seguidores || 0 : 0
  const crecimientoSeg = segInicial ? (((segFinal - segInicial) / segInicial) * 100).toFixed(1) : "0"
  const nuevosSeguidores = segFinal - segInicial
  const avgCTRMeta = metaData.length ? (metaData.reduce((a, s) => a + s.meta.ctr, 0) / metaData.length).toFixed(2) : "—"
  const avgCPRMeta = metaData.length ? (metaData.reduce((a, s) => a + s.meta.cpr, 0) / metaData.length).toFixed(2) : "—"
  const avgCTRGoogle = googleData.length ? (googleData.reduce((a, s) => a + s.google.ctr, 0) / googleData.length).toFixed(2) : "—"
  const metaConRoas: EntryWithMetaRoas[] = metaData.filter(
    (s): s is EntryWithMetaRoas => s.meta.roas !== null && s.meta.roas !== undefined,
  )
  const avgROAS = metaConRoas.length ? (metaConRoas.reduce((a, s) => a + s.meta.roas, 0) / metaConRoas.length).toFixed(2) : null

  const evolucion = mesesActivos.map((mes, i) => {
    const idx = idxActivos[i]
    const h = HISTORICO[cliente.id]?.[idx]
    const m = h?.meta?.costo || 0
    const g = h?.google?.costo || 0
    return { mes, metaInv: m, googleInv: g, total: m + g, alcance: (h?.meta?.alcance || 0) + (h?.google?.alcance || 0) }
  })
  const maxInv = Math.max(...evolucion.map((e) => e.total)) || 1
  const maxAlcance = Math.max(...evolucion.map((e) => e.alcance)) || 1

  function trend(arr: EntryWithMeta[], key: MetaTrendKey): string | null {
    if (arr.length < 2) return null
    const f = (arr[0].meta[key] as number | undefined) || 0
    const l = (arr[arr.length - 1].meta[key] as number | undefined) || 0
    if (!f) return null
    return (((l - f) / f) * 100).toFixed(1)
  }
  const trendAlcance = trend(metaData, "alcance")
  const trendCtr = trend(metaData, "ctr")
  const trendCpr = trend(metaData, "cpr")
  const trendInter = trend(metaData, "interacciones")

  const recs: Recomendacion[] = []
  if (metaData.length && parseFloat(avgCPRMeta) > 0.65) recs.push({ tipo: "alerta", texto: `Costo por resultado promedio elevado ($${avgCPRMeta}). Revisar segmentación y creatividades.` })
  if (metaData.length && parseFloat(avgCPRMeta) < 0.35) recs.push({ tipo: "exito", texto: `CPR excelente ($${avgCPRMeta}). Considerar escalar presupuesto.` })
  if (avgROAS && parseFloat(avgROAS) < 3) recs.push({ tipo: "alerta", texto: `ROAS bajo (${avgROAS}x). Evaluar embudo de conversión.` })
  if (avgROAS && parseFloat(avgROAS) >= 4) recs.push({ tipo: "exito", texto: `ROAS sobresaliente (${avgROAS}x). Cliente listo para incrementar inversión.` })
  if (metaData.length && parseFloat(avgCTRMeta) > 4) recs.push({ tipo: "exito", texto: `CTR sobresaliente (${avgCTRMeta}%). Las creatividades conectan bien.` })
  if (metaData.length && parseFloat(avgCTRMeta) < 2.5) recs.push({ tipo: "alerta", texto: `CTR bajo (${avgCTRMeta}%). Renovar creatividades y copy.` })
  if (metaData.length && !googleData.length) recs.push({ tipo: "info", texto: `Sin pauta en Google Ads. Oportunidad de captar demanda en búsqueda.` })
  if (trendInter && parseFloat(trendInter) > 30) recs.push({ tipo: "exito", texto: `Crecimiento de interacciones del +${trendInter}%.` })

  function TrendArrow({ value }: { value: string | null }) {
    if (value === null) return null
    const v = parseFloat(value)
    return <span className={`text-[10px] font-medium ${v > 0 ? "text-emerald-600" : v < 0 ? "text-red-600" : "text-zinc-500"}`}>{v > 0 ? "↑" : v < 0 ? "↓" : "→"} {Math.abs(v)}%</span>
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between z-10 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: cliente.color }} />
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Informe completo · {cliente.nombre}</h2>
              <p className="text-xs text-zinc-500">{cliente.industria} · {mesesActivos[0]} – {mesesActivos[mesesActivos.length - 1]} · Generado 12/05/2026</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={rangoKey} onChange={(e) => setRangoKey(e.target.value as RangoKey)} className="text-xs border border-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none">
              <option value="5-5">Mayo (1 mes)</option>
              <option value="3-5">Últimos 3 meses</option>
              <option value="0-5">Últimos 6 meses</option>
              <option value="0-2">Dic – Feb</option>
            </select>
            <button onClick={() => window.print()} className="px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">📄 PDF / Imprimir</button>
            <button onClick={onClose} className="px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors">Cerrar</button>
          </div>
        </div>
        <div className="p-6 space-y-8 text-zinc-900">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-3">1 · Resumen del período</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">Inversión total</p><p className="text-xl font-bold">${totalInv.toLocaleString()}</p></div>
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">Alcance total</p><p className="text-xl font-bold">{totalAlcance.toLocaleString()}</p><p className="text-[10px]"><TrendArrow value={trendAlcance} /></p></div>
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">Impresiones</p><p className="text-xl font-bold">{totalImpresiones.toLocaleString()}</p></div>
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">Nuevos seguidores</p><p className="text-xl font-bold text-emerald-600">+{nuevosSeguidores.toLocaleString()}</p><p className="text-[10px] text-zinc-500">+{crecimientoSeg}%</p></div>
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">CTR Meta</p><p className="text-xl font-bold">{avgCTRMeta}%</p><p className="text-[10px]"><TrendArrow value={trendCtr} /></p></div>
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">CPR Meta</p><p className="text-xl font-bold">${avgCPRMeta}</p><p className="text-[10px]"><TrendArrow value={trendCpr ? (-parseFloat(trendCpr)).toFixed(1) : null} /></p></div>
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">ROAS</p><p className={`text-xl font-bold ${avgROAS && parseFloat(avgROAS) >= 4 ? "text-emerald-600" : avgROAS && parseFloat(avgROAS) < 3 ? "text-red-600" : ""}`}>{avgROAS ? `${avgROAS}x` : "—"}</p></div>
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">Conversiones</p><p className="text-xl font-bold">{totalConversiones || "—"}</p></div>
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-3">2 · Evolución mes a mes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                <p className="text-[11px] font-semibold text-zinc-700 mb-3">Inversión por mes</p>
                <div className="flex items-end gap-2 h-32">
                  {evolucion.map((e) => {
                    const hM = (e.metaInv / maxInv) * 100
                    const hG = (e.googleInv / maxInv) * 100
                    return (
                      <div key={e.mes} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-zinc-500">${e.total}</span>
                        <div className="w-full flex flex-col justify-end" style={{ height: "70%" }}>
                          <div className="bg-amber-400 rounded-t" style={{ height: `${hG}%`, minHeight: hG > 0 ? "3px" : 0 }} />
                          <div className="bg-sky-500" style={{ height: `${hM}%`, minHeight: hM > 0 ? "3px" : 0 }} />
                        </div>
                        <span className="text-[10px] font-medium text-zinc-700">{e.mes}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                <p className="text-[11px] font-semibold text-zinc-700 mb-3">Alcance por mes</p>
                <div className="flex items-end gap-2 h-32">
                  {evolucion.map((e) => {
                    const h = (e.alcance / maxAlcance) * 100
                    return (
                      <div key={e.mes} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-zinc-500">{(e.alcance / 1000).toFixed(1)}k</span>
                        <div className="w-full flex flex-col justify-end" style={{ height: "70%" }}>
                          <div className="rounded-t" style={{ height: `${h}%`, minHeight: h > 0 ? "3px" : 0, background: cliente.color }} />
                        </div>
                        <span className="text-[10px] font-medium text-zinc-700">{e.mes}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-3">3 · Recomendaciones personalizadas</h3>
            <div className="space-y-2">
              {recs.length === 0 && <p className="text-xs text-zinc-500 italic">Sin observaciones — cliente dentro de parámetros óptimos.</p>}
              {recs.map((r, i) => {
                const bg = r.tipo === "alerta" ? "bg-red-50 border-red-200" : r.tipo === "exito" ? "bg-emerald-50 border-emerald-200" : "bg-sky-50 border-sky-200"
                const icon = r.tipo === "alerta" ? "⚠" : r.tipo === "exito" ? "✓" : "💡"
                return (<div key={i} className={`border rounded-lg p-3 flex items-start gap-3 ${bg}`}><span className="text-base">{icon}</span><p className="text-xs text-zinc-700 flex-1">{r.texto}</p></div>)
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
