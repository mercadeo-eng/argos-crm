"use client"
import { useState } from "react"
import { HISTORICO } from "@/lib/historico"
import { labels as appLabels } from "@/lib/labels"
import type { Cliente, HistoricoEntry } from "@/lib/types"

const MESES = ["Dic", "Ene", "Feb", "Mar", "Abr", "May"] as const
type RangoKey = "0-5" | "3-5" | "5-5"

// Agregados por cliente para el rango de meses activo.
type ClienteAgg = {
  meta: {
    inversion: number
    ctrAvg: string
    cprAvg: string
    roasAvg: string | null
  } | null
  google: {
    inversion: number
  } | null
}

type Props = {
  clientes: Record<string, Cliente>
  onClose: () => void
}

// ─── INFORME GLOBAL ───────────────────────────────────────────────────────────
export function InformeGlobalModal({ clientes, onClose }: Props) {
  const [rangoKey, setRangoKey] = useState<RangoKey>("0-5")
  const [from, to] = rangoKey.split("-").map(Number)
  const mesesActivos = MESES.slice(from, to + 1)
  const idxActivos = mesesActivos.map((m) => MESES.indexOf(m as (typeof MESES)[number]))

  function agg(cId: string): ClienteAgg {
    const hist: HistoricoEntry[] = HISTORICO[cId] || []
    const slice = idxActivos.map((i) => hist[i]).filter(Boolean)
    const meta = slice.filter((s) => s.meta) as Array<HistoricoEntry & { meta: NonNullable<HistoricoEntry["meta"]> }>
    const google = slice.filter((s) => s.google) as Array<HistoricoEntry & { google: NonNullable<HistoricoEntry["google"]> }>
    return {
      meta: meta.length
        ? {
            inversion: meta.reduce((a, s) => a + s.meta.costo, 0),
            ctrAvg: (meta.reduce((a, s) => a + s.meta.ctr, 0) / meta.length).toFixed(2),
            cprAvg: (meta.reduce((a, s) => a + s.meta.cpr, 0) / meta.length).toFixed(2),
            roasAvg: meta.filter((s) => s.meta.roas).length
              ? (
                  meta.filter((s) => s.meta.roas).reduce((a, s) => a + (s.meta.roas as number), 0) /
                  meta.filter((s) => s.meta.roas).length
                ).toFixed(2)
              : null,
          }
        : null,
      google: google.length
        ? { inversion: google.reduce((a, s) => a + s.google.costo, 0) }
        : null,
    }
  }

  const cData = Object.values(clientes)
    .filter((c) => HISTORICO[c.id])
    .map((c) => ({ ...c, agg: agg(c.id) }))
  const totalMetaInv = cData.reduce((a, c) => a + (c.agg.meta?.inversion || 0), 0)
  const totalGoogleInv = cData.reduce((a, c) => a + (c.agg.google?.inversion || 0), 0)
  const totalInv = totalMetaInv + totalGoogleInv
  const conMeta = cData.filter((c) => c.agg.meta)
  const avgCTRMeta = conMeta.length
    ? (
        conMeta.reduce((a, c) => a + parseFloat(c.agg.meta!.ctrAvg), 0) / conMeta.length
      ).toFixed(2)
    : "—"
  const conRoas = cData.filter((c) => c.agg.meta?.roasAvg)
  const avgROAS = conRoas.length
    ? (
        conRoas.reduce((a, c) => a + parseFloat(c.agg.meta!.roasAvg as string), 0) / conRoas.length
      ).toFixed(2)
    : "—"

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between z-10 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{appLabels.reportTitle ?? "Informe completo"} — Vista global</h2>
            <p className="text-xs text-zinc-500">{mesesActivos[0]} – {mesesActivos[mesesActivos.length - 1]}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={rangoKey} onChange={(e) => setRangoKey(e.target.value as RangoKey)} className="text-xs border border-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none">
              <option value="5-5">Mayo (1 mes)</option><option value="3-5">Últimos 3 meses</option><option value="0-5">Últimos 6 meses</option>
            </select>
            <button onClick={() => window.print()} className="px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium">📄 PDF</button>
            <button onClick={onClose} className="px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg">Cerrar</button>
          </div>
        </div>
        <div className="p-6 space-y-6 text-zinc-900">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">Inversión total</p><p className="text-xl font-bold">${totalInv.toLocaleString()}</p></div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">Clientes</p><p className="text-xl font-bold">{conMeta.length}</p></div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">CTR prom.</p><p className="text-xl font-bold">{avgCTRMeta}%</p></div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><p className="text-[10px] text-zinc-500 uppercase">ROAS prom.</p><p className="text-xl font-bold text-emerald-600">{avgROAS}x</p></div>
          </div>
          <div className="space-y-2">
            {cData.map((c) => (
              <div key={c.id} className="border border-zinc-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                <span className="text-sm font-semibold flex-1">{c.nombre}</span>
                {c.agg.meta && (
                  <>
                    <span className="text-xs text-zinc-500">Inv: ${c.agg.meta.inversion.toLocaleString()}</span>
                    <span className="text-xs text-zinc-500">CTR: {c.agg.meta.ctrAvg}%</span>
                    {c.agg.meta.roasAvg && <span className="text-xs text-emerald-700">ROAS: {c.agg.meta.roasAvg}x</span>}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
