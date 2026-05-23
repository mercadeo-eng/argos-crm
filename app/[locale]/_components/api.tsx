"use client"
import { useState } from "react"
import { useTranslations, useFormatter } from "next-intl"
import { labels as appLabels } from "@/lib/labels"
import type { MetaConnection, GoogleConnection } from "@/lib/types"

export function maskValue(v: string | null | undefined): string {
  if (!v) return ""
  if (v.length <= 6) return "•".repeat(v.length)
  return "•".repeat(Math.max(6, v.length - 5)) + v.slice(-5)
}

type OAuthMockResult = MetaConnection | GoogleConnection

export function simulateOAuth(provider: "meta" | "google"): Promise<OAuthMockResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mock: OAuthMockResult = provider === "meta"
        ? {
            accountName: "Cuenta Meta Demo",
            accountId: "act_" + Math.floor(Math.random() * 1e15).toString(),
            pageName: "Página Comercial del Cliente",
            pageId: Math.floor(Math.random() * 1e15).toString(),
            scope: ["ads_management", "ads_read", "pages_read_engagement", "business_management"],
            token: "EAA" + Math.random().toString(36).slice(2),
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          }
        : {
            accountName: "Cuenta Google Ads del Cliente",
            customerId: Array.from({ length: 10 }, () => Math.floor(Math.random() * 10))
              .join("")
              .replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3"),
            managerAccount: "Cuenta MCC",
            scope: ["https://www.googleapis.com/auth/adwords"],
            developerToken: "DEV" + Math.random().toString(36).slice(2, 20).toUpperCase(),
            refreshToken: "1//0g" + Math.random().toString(36).slice(2),
            connectedAt: new Date().toISOString(),
          }
      resolve(mock)
    }, 1500)
  })
}

type ApiConnectorProps = {
  provider: "meta" | "google"
  conexion: MetaConnection | GoogleConnection | null | undefined
  onConnect: (v: OAuthMockResult) => void
  onDisconnect: () => void
}

export function ApiConnector({ provider, conexion, onConnect, onDisconnect }: ApiConnectorProps) {
  const t = useTranslations("api")
  const format = useFormatter()
  const [connecting, setConnecting] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const isMeta = provider === "meta"
  const providerLabel = isMeta ? "Meta Business Suite" : "Google Ads"
  const providerIcon = isMeta ? "📘" : "🔶"
  const providerDesc = isMeta ? t("metaDesc") : t("googleDesc")
  const btnColor = isMeta ? "bg-sky-500 hover:bg-sky-400" : "bg-amber-500 hover:bg-amber-400"
  const accentBg = isMeta ? "bg-sky-500/10 border-sky-500/30" : "bg-amber-500/10 border-amber-500/30"
  const scopes = isMeta
    ? [
        { id: "ads_management", label: t("scopeManageCampaigns") },
        { id: "ads_read", label: t("scopeReadAdsMetrics") },
        { id: "pages_read_engagement", label: t("scopeReadPageEngagement") },
        { id: "business_management", label: t("scopeBusinessManager") },
      ]
    : [
        { id: "adwords", label: t("scopeManageGoogleAds") },
        { id: "ads_read", label: t("scopeReadPerformance") },
        { id: "account_read", label: t("scopeAccountInfo") },
      ]

  async function handleConnect() {
    setConnecting(true)
    try {
      const result = await simulateOAuth(provider)
      onConnect(result)
    } finally {
      setConnecting(false)
    }
  }
  function handleDisconnect() {
    if (confirm(t("disconnectConfirm", { provider: providerLabel }))) onDisconnect()
  }

  if (conexion) {
    const meta = isMeta ? (conexion as MetaConnection) : null
    const goog = !isMeta ? (conexion as GoogleConnection) : null
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{providerIcon}</span>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                {providerLabel}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t("connected")}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">{conexion.accountName}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 space-y-1.5 mb-3">
          {meta ? (
            <>
              <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">{t("accountAd")}</span><span className="font-mono text-zinc-300">{maskValue(meta.accountId)}</span></div>
              <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">{t("linkedPage")}</span><span className="text-zinc-300">{meta.pageName}</span></div>
              <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">{t("tokenExpires")}</span><span className="text-zinc-300">{format.dateTime(new Date(meta.expiresAt), { day: "numeric", month: "short", year: "numeric" })}</span></div>
            </>
          ) : goog ? (
            <>
              <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">{t("customerId")}</span><span className="font-mono text-zinc-300">{goog.customerId}</span></div>
              <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">{t("managerAccount")}</span><span className="text-zinc-300">{goog.managerAccount}</span></div>
              <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">{t("connectedOn")}</span><span className="text-zinc-300">{format.dateTime(new Date(goog.connectedAt), { day: "numeric", month: "short", year: "numeric" })}</span></div>
            </>
          ) : null}
        </div>
        <button onClick={() => setShowDetails(!showDetails)} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-2">
          {showDetails ? "▼" : "▶"} {t("technicalDetails")}
        </button>
        {showDetails && (
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-3 text-[11px] space-y-1.5 mb-3 font-mono">
            {meta ? (
              <>
                <div className="flex justify-between gap-3"><span className="text-zinc-500">Access Token</span><span className="text-zinc-400 truncate max-w-[200px]">{maskValue(meta.token)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-zinc-500">Ad Account ID</span><span className="text-zinc-400">{meta.accountId}</span></div>
                <div className="flex justify-between gap-3"><span className="text-zinc-500">Page ID</span><span className="text-zinc-400">{meta.pageId}</span></div>
              </>
            ) : goog ? (
              <>
                <div className="flex justify-between gap-3"><span className="text-zinc-500">Developer Token</span><span className="text-zinc-400">{maskValue(goog.developerToken)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-zinc-500">Refresh Token</span><span className="text-zinc-400 truncate max-w-[200px]">{maskValue(goog.refreshToken)}</span></div>
              </>
            ) : null}
            <div className="pt-1.5 mt-1.5 border-t border-zinc-800">
              <span className="text-zinc-500 block mb-1">{t("permissionsGranted")}</span>
              <div className="flex flex-wrap gap-1">
                {(conexion.scope || []).map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-600">{t("autoSync")}</p>
          <div className="flex gap-2">
            <button onClick={handleConnect} className="px-3 py-1.5 rounded-lg text-[11px] bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors">🔄 {t("reconnect")}</button>
            <button onClick={handleDisconnect} className="px-3 py-1.5 rounded-lg text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">{t("disconnect")}</button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className={`border rounded-2xl p-5 ${accentBg}`}>
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <span className="text-2xl">{providerIcon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-200">{providerLabel}</h3>
          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{providerDesc}</p>
        </div>
      </div>
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 mb-4">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">{t("scopesIntro")}</p>
        <ul className="space-y-1">
          {scopes.map((s) => (
            <li key={s.id} className="text-[11px] text-zinc-400 flex items-start gap-1.5">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={handleConnect}
        disabled={connecting}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-all ${btnColor} ${connecting ? "opacity-60 cursor-wait" : ""}`}
      >
        {connecting ? (
          <>
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {t("connecting", { provider: providerLabel })}
          </>
        ) : (
          <>
            <span>{providerIcon}</span>
            {t("connect", { provider: providerLabel })}
          </>
        )}
      </button>
      <p className="text-[10px] text-zinc-500 mt-3 text-center">{t("redirectNotice", { provider: isMeta ? "Facebook" : "Google" })}</p>
    </div>
  )
}

type ApiTabProps = {
  apiData: { meta?: MetaConnection | null; google?: GoogleConnection | null }
  onUpdate: (provider: "meta" | "google", value: OAuthMockResult | null) => void
}

export function ApiTab({ apiData, onUpdate }: ApiTabProps) {
  const t = useTranslations("api")
  const tClient = useTranslations("client")
  const tn = useTranslations("nav")
  const metricsLabel = appLabels.metricsModule ?? tClient("tabMetrics")
  const reportLabel = appLabels.reportTitle ?? tClient("generateReport")
  const metricsGlobalLabel = appLabels.metricsModuleGlobal ?? tn("metricsGlobal")
  const metaC = !!apiData.meta
  const googleC = !!apiData.google
  return (
    <div className="space-y-4">
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔌</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-violet-300 mb-1">{t("tabTitle")}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{t("tabBody", { metrics: metricsLabel, report: reportLabel, metricsGlobal: metricsGlobalLabel })}</p>
            <div className="flex items-center gap-3 mt-3 text-[11px]">
              <span className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${metaC ? "bg-emerald-400" : "bg-zinc-600"}`} />
                <span className={metaC ? "text-emerald-300" : "text-zinc-500"}>{metaC ? t("metaConnected") : t("metaDisconnected")}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${googleC ? "bg-emerald-400" : "bg-zinc-600"}`} />
                <span className={googleC ? "text-emerald-300" : "text-zinc-500"}>{googleC ? t("googleConnected") : t("googleDisconnected")}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <ApiConnector provider="meta" conexion={apiData.meta} onConnect={(v) => onUpdate("meta", v)} onDisconnect={() => onUpdate("meta", null)} />
      <ApiConnector provider="google" conexion={apiData.google} onConnect={(v) => onUpdate("google", v)} onDisconnect={() => onUpdate("google", null)} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-[11px] text-zinc-500 space-y-1.5">
        <p className="text-zinc-400 font-medium mb-2">{t("howItWorksTitle")}</p>
        <p>• {t("howItWorks1")}</p>
        <p>• {t("howItWorks2")}</p>
        <p>• {t("howItWorks3")}</p>
        <p>• {t("howItWorks4")}</p>
      </div>
    </div>
  )
}
