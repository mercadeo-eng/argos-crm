"use client"
import { useTranslations, useFormatter } from "next-intl"
import { fmtDate } from "@/lib/format"
import { stageLabels as ETAPA_LABELS } from "@/lib/stages"
import type { Cliente, Etapa } from "@/lib/types"
import { Metric, estadoBadge } from "./atoms"
import { Heatmap } from "./heatmap"

type DashboardPageProps = {
  clientes: Record<string, Cliente>
  onNavigate: (page: string) => void
}

type ProximaEntrega = Etapa & { cliente: string; clienteId: string; color: string }

export function DashboardPage({ clientes, onNavigate }: DashboardPageProps) {
  const t = useTranslations("dashboard")
  const format = useFormatter()
  const total = Object.values(clientes).length
  const sinFecha = Object.values(clientes).reduce((acc, c) => acc + c.etapas.filter((e) => !e.fecha && !e.calId).length, 0)
  const activos = Object.values(clientes).filter((c) => c.estado === "activo").length
  const proximas: ProximaEntrega[] = Object.values(clientes)
    .flatMap((c) =>
      c.etapas
        .filter((e) => e.fecha && e.estado !== "listo")
        .map((e) => ({ ...e, cliente: c.nombre, clienteId: c.id, color: c.color }))
    )
    .sort((a, b) => (a.fecha! < b.fecha! ? -1 : a.fecha! > b.fecha! ? 1 : 0))
    .slice(0, 6)
  const currentMonth = format.dateTime(new Date(), { month: "long" })
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">{t("title")}</h1>
          <p className="text-sm text-zinc-500 mt-0.5 capitalize">
            {format.dateTime(new Date(), { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => onNavigate("planificador")}
          className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-lg text-sm hover:bg-violet-500/30 transition-colors"
        >
          📅 {t("planDates")}
          {sinFecha > 0 && (
            <span className="bg-violet-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{sinFecha}</span>
          )}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label={t("activeClients")} value={activos} sub={t("totalCount", { count: total })} />
        <Metric label={t("withoutDate")} value={sinFecha} sub={t("stagesToAssign")} valueColor="text-amber-400" />
        <Metric label={t("withActiveMetrics")} value="5" sub={t("channelsMetaGoogle")} />
        <Metric label={t("totalInvestment")} value="$2,960" sub={t("investmentSub", { month: currentMonth })} />
      </div>
      <Heatmap clientes={clientes} onClienteClick={(id) => onNavigate(`cliente:${id}`)} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">{t("upcomingDeliveries")}</h3>
        <div className="space-y-2">
          {proximas.map((e, i) => (
            <div
              key={i}
              onClick={() => onNavigate(`cliente:${e.clienteId}`)}
              className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0 cursor-pointer hover:bg-zinc-800/50 rounded-lg px-2 -mx-2 transition-colors"
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
              <span className="text-sm text-zinc-200 flex-1">
                {e.cliente} — {ETAPA_LABELS[e.etapa]}
              </span>
              <span className="text-xs text-zinc-500">{fmtDate(e.fecha, e.hora)}</span>
              {estadoBadge(e.estado)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
