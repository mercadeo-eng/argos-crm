"use client"
import { useState } from "react"
import { useTranslations, useFormatter } from "next-intl"
import { labels as appLabels } from "@/lib/labels"
import { Metric } from "./atoms"
import { InformeGlobalModal } from "./informe-global-modal"
import type { ApiKeys, Cliente, Pauta, PautaGoogle, PautaMeta } from "@/lib/types"

type Platform = "meta" | "google"

// Helpers para narrow Cliente → Cliente con pauta concreta. La forma del
// tipo Pauta admite meta/google null|undefined; estos predicates dan el
// tipado preciso al sort/map siguiente sin proliferación de non-null
// assertions.
type ClienteConMeta = Cliente & { pautas: Pauta & { meta: PautaMeta } }
type ClienteConGoogle = Cliente & { pautas: Pauta & { google: PautaGoogle } }
type ClienteConRoas = ClienteConMeta & { pautas: { meta: PautaMeta & { roas: number } } }

function hasMeta(c: Cliente): c is ClienteConMeta {
  return !!c.pautas?.meta
}
function hasGoogle(c: Cliente): c is ClienteConGoogle {
  return !!c.pautas?.google
}
function hasMetaRoas(c: ClienteConMeta): c is ClienteConRoas {
  return c.pautas.meta.roas !== null && c.pautas.meta.roas !== undefined
}

type Props = {
  clientes: Record<string, Cliente>
  apiKeys: Record<string, ApiKeys>
}

// ─── PAUTAS GLOBAL ────────────────────────────────────────────────────────────
export function PautasPage({ clientes, apiKeys }: Props) {
  const t = useTranslations("metricsPage")
  const td = useTranslations("dashboard")
  const tn = useTranslations("nav")
  const format = useFormatter()
  const [platform, setPlatform] = useState<Platform>("meta")
  const [showInforme, setShowInforme] = useState(false)
  const conMeta = Object.values(clientes).filter(hasMeta)
  const conGoogle = Object.values(clientes).filter(hasGoogle)
  const apiObj = apiKeys || {}
  const metaCon = Object.values(apiObj).filter((k) => k?.meta).length
  const googleCon = Object.values(apiObj).filter((k) => k?.google).length
  const totalCli = Object.keys(clientes).length
  const totalInv =
    conMeta.reduce((a, c) => a + (c.pautas.meta.costo || 0), 0) +
    conGoogle.reduce((a, c) => a + (c.pautas.google.costo || 0), 0)
  const avgCTR = (conMeta.reduce((a, c) => a + c.pautas.meta.ctr, 0) / (conMeta.length || 1)).toFixed(1)
  const conRoas = conMeta.filter(hasMetaRoas)
  const avgROAS = (conRoas.reduce((a, c) => a + c.pautas.meta.roas, 0) / (conRoas.length || 1)).toFixed(1)
  // lista cambia de tipo según platform; cada rama tiene su propio ctr.
  const ctrFor = (c: Cliente): number =>
    platform === "meta" ? (c.pautas?.meta?.ctr ?? 0) : (c.pautas?.google?.ctr ?? 0)
  const lista: Cliente[] = platform === "meta" ? conMeta : conGoogle
  const maxCTR = Math.max(...lista.map(ctrFor))
  const currentMonth = format.dateTime(new Date(), { month: "long" })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-white">{appLabels.metricsModuleGlobal ?? tn("metricsGlobal")}</h2>
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${metaCon > 0 ? "bg-sky-500/15 text-sky-300 border-sky-500/30" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${metaCon > 0 ? "bg-sky-400" : "bg-zinc-600"}`} />📘 {t("metaApiStatus", { n: metaCon, total: totalCli })}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${googleCon > 0 ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${googleCon > 0 ? "bg-amber-400" : "bg-zinc-600"}`} />🔶 {t("googleApiStatus", { n: googleCon, total: totalCli })}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label={td("totalInvestment")} value={`$${totalInv.toLocaleString()}`} sub={td("investmentSub", { month: currentMonth })} />
        <Metric label={t("clientsActive")} value={conMeta.length} sub={t("withMetaAds")} />
        <Metric label={t("avgCTR")} value={`${avgCTR}%`} sub="Meta Ads" />
        <Metric label={t("avgROAS")} value={`${avgROAS}x`} sub={t("clientsWithEcomm")} valueColor="text-emerald-400" />
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{t("ctrByClient")}</h3>
          <div className="flex gap-2">
            {(["meta", "google"] as const).map((p) => (
              <button key={p} onClick={() => setPlatform(p)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${platform === p ? "bg-sky-500/20 border border-sky-500/30 text-sky-300" : "text-zinc-500 hover:text-zinc-300"}`}>
                {p === "meta" ? "Meta Ads" : "Google Ads"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {lista
            .slice()
            .sort((a, b) => ctrFor(b) - ctrFor(a))
            .map((c) => {
              const ctr = ctrFor(c)
              const pct = (ctr / maxCTR) * 100
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-sm text-zinc-300 w-40 flex-shrink-0 truncate">{c.nombre}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: c.color }} />
                  </div>
                  <span className="text-xs font-medium text-zinc-300 w-10 text-right">{ctr}%</span>
                </div>
              )
            })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">{t("costPerResult")}</h3>
          {conMeta
            .slice()
            .sort((a, b) => a.pautas.meta.cpr - b.pautas.meta.cpr)
            .map((c) => {
              const cpr = c.pautas.meta.cpr
              const color = cpr < 0.35 ? "#10B981" : cpr < 0.55 ? "#F59E0B" : "#EF4444"
              const label = cpr < 0.35 ? t("ratingExcellent") : cpr < 0.55 ? t("ratingRegular") : t("ratingOptimize")
              return (
                <div key={c.id} className="flex items-center py-2 border-b border-zinc-800 last:border-0">
                  <span className="text-sm text-zinc-300 flex-1 truncate mr-2">{c.nombre}</span>
                  <span className="text-sm font-semibold mr-2" style={{ color }}>${cpr}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ color, borderColor: color + "40", background: color + "15" }}>{label}</span>
                </div>
              )
            })}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">ROAS</h3>
          {conRoas
            .slice()
            .sort((a, b) => b.pautas.meta.roas - a.pautas.meta.roas)
            .map((c) => {
              const roas = c.pautas.meta.roas
              const pct = (roas / 6) * 100
              return (
                <div key={c.id} className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
                  <span className="text-sm text-zinc-300 w-32 flex-shrink-0 truncate">{c.nombre}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: roas >= 4 ? "#10B981" : "#F59E0B" }} />
                  </div>
                  <span className="text-sm font-semibold text-zinc-200 w-8 text-right">{roas}x</span>
                </div>
              )
            })}
          <button onClick={() => setShowInforme(true)} className="mt-4 w-full py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors">
            {t("generateGlobalReport")} ↗
          </button>
        </div>
      </div>
      {showInforme && <InformeGlobalModal clientes={clientes} onClose={() => setShowInforme(false)} />}
    </div>
  )
}
