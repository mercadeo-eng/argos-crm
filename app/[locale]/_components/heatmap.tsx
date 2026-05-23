"use client"
import { useTranslations, useFormatter } from "next-intl"
import { fmtDate } from "@/lib/format"
import { stageIds as ETAPAS_ORDEN, stageIcons as ETAPA_ICONS, stageLabels as ETAPA_LABELS } from "@/lib/stages"
import type { Cliente, Etapa } from "@/lib/types"

type HeatmapProps = {
  clientes: Record<string, Cliente>
  onClienteClick: (id: string) => void
}

type CellStyle = { bg: string; text: string; label: string }

function cellStyle(e: Etapa): CellStyle {
  if (!e.calId && !e.fecha) return { bg: "border border-dashed border-zinc-700", text: "text-zinc-600", label: "—" }
  if (e.estado === "listo") return { bg: "bg-emerald-500/20 border border-emerald-500/30", text: "text-emerald-400", label: fmtDate(e.fecha, e.hora) }
  if (e.estado === "en_curso") return { bg: "bg-sky-500/20 border border-sky-500/30", text: "text-sky-400", label: fmtDate(e.fecha, e.hora) }
  if (e.estado === "atrasado") return { bg: "bg-red-500/20 border border-red-500/30", text: "text-red-400", label: fmtDate(e.fecha, e.hora) }
  if (e.fecha) return { bg: "bg-zinc-800 border border-zinc-700", text: "text-zinc-400", label: fmtDate(e.fecha, e.hora) }
  return { bg: "border border-dashed border-zinc-700", text: "text-zinc-600", label: "—" }
}

export function Heatmap({ clientes, onClienteClick }: HeatmapProps) {
  const t = useTranslations("heatmap")
  const format = useFormatter()
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthRange = `${format.dateTime(now, { month: "long" })} / ${format.dateTime(next, { month: "long", year: "numeric" })}`
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
          {t("title")} — <span className="capitalize">{monthRange}</span>
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-emerald-500/30 border border-emerald-500/40 inline-block" />
            {t("statusReady")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-zinc-800 border border-zinc-700 inline-block" />
            {t("statusScheduled")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm border border-dashed border-zinc-700 inline-block" />
            {t("statusNoDate")}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th className="text-left text-[10px] text-zinc-600 font-medium pb-2 w-32">{t("clientColumn")}</th>
              {ETAPAS_ORDEN.map((e) => (
                <th key={e} className="text-center text-[10px] text-zinc-600 font-medium pb-2 px-1">
                  {ETAPA_ICONS[e]}
                  <div>{(ETAPA_LABELS[e] || "").split("-")[0]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.values(clientes).map((c) => (
              <tr key={c.id} className="cursor-pointer group" onClick={() => onClienteClick(c.id)}>
                <td className="py-1 pr-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <span className="text-xs text-zinc-300 group-hover:text-white transition-colors truncate">{c.nombre}</span>
                  </div>
                </td>
                {c.etapas.map((e, i) => {
                  const s = cellStyle(e)
                  return (
                    <td key={i} className="py-1 px-1">
                      <div className={`rounded-md h-7 flex items-center justify-center text-[10px] font-medium ${s.bg} ${s.text}`}>{s.label}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
