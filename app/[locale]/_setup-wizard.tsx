"use client"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Brand } from "./_brand"

type Health = {
  supabaseConfigured: boolean
  migrationsRan: boolean
  hasAdmin: boolean
  googleConfigured: boolean
}

// Setup wizard: se renderiza cuando la app NO está en demo mode pero el
// backend todavía no está completamente configurado. Es solo onboarding
// guiado — no escribe en disco ni toca el entorno; el comprador hace los
// cambios en su .env.local / dashboard y refresca.
export function SetupWizard({ onTryDemo, onRefresh }: { onTryDemo: () => void; onRefresh: () => void }) {
  const t = useTranslations("setup")
  const [health, setHealth] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  async function check() {
    setChecking(true)
    try {
      const r = await fetch("/api/setup/health", { cache: "no-store" })
      const data = await r.json()
      setHealth(data)
    } catch {
      setHealth({ supabaseConfigured: false, migrationsRan: false, hasAdmin: false, googleConfigured: false })
    } finally {
      setLoading(false)
      setChecking(false)
    }
  }

  useEffect(() => {
    check()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-sky-400 animate-spin" />
      </div>
    )
  }

  const allDone = health?.supabaseConfigured && health?.migrationsRan && health?.hasAdmin
  const steps: { id: string; done: boolean; titleKey: string; descKey: string; helpHref?: string; helpKey?: string }[] = [
    {
      id: "env",
      done: !!health?.supabaseConfigured,
      titleKey: "stepEnvTitle",
      descKey: health?.supabaseConfigured ? "stepEnvDoneDesc" : "stepEnvTodoDesc",
      helpHref: "https://supabase.com/dashboard",
      helpKey: "stepEnvHelp",
    },
    {
      id: "migrations",
      done: !!health?.migrationsRan,
      titleKey: "stepMigrationsTitle",
      descKey: health?.migrationsRan ? "stepMigrationsDoneDesc" : "stepMigrationsTodoDesc",
      helpHref: "https://supabase.com/dashboard/project/_/sql/new",
      helpKey: "stepMigrationsHelp",
    },
    {
      id: "admin",
      done: !!health?.hasAdmin,
      titleKey: "stepAdminTitle",
      descKey: health?.hasAdmin ? "stepAdminDoneDesc" : "stepAdminTodoDesc",
      helpHref: "https://supabase.com/dashboard/project/_/auth/users",
      helpKey: "stepAdminHelp",
    },
    {
      id: "google",
      done: !!health?.googleConfigured,
      titleKey: "stepGoogleTitle",
      descKey: health?.googleConfigured ? "stepGoogleDoneDesc" : "stepGoogleOptionalDesc",
      helpHref: "https://console.cloud.google.com/apis/credentials",
      helpKey: "stepGoogleHelp",
    },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <Brand className="text-2xl" />
          <h1 className="text-lg font-semibold text-white mt-3">{t("title")}</h1>
          <p className="text-sm text-zinc-500 mt-1">{t("subtitle")}</p>
        </div>

        <ol className="space-y-3 mb-5">
          {steps.map((step, idx) => (
            <li
              key={step.id}
              className={`flex items-start gap-3 rounded-2xl border p-4 ${
                step.done
                  ? "bg-emerald-500/5 border-emerald-500/30"
                  : step.id === "google"
                  ? "bg-zinc-900 border-zinc-800"
                  : "bg-amber-500/5 border-amber-500/30"
              }`}
            >
              <div
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step.done
                    ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                }`}
              >
                {step.done ? "✓" : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-sm font-semibold text-white">{t(step.titleKey)}</h3>
                  {step.id === "google" && !step.done && (
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">{t("optional")}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t(step.descKey)}</p>
                {!step.done && step.helpHref && step.helpKey && (
                  <a
                    href={step.helpHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 mt-2 font-medium"
                  >
                    {t(step.helpKey)} <span>↗</span>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2">
          {allDone ? (
            <button
              onClick={onRefresh}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-sky-500 hover:bg-sky-400 text-white transition-colors"
            >
              {t("ctaGoToLogin")} →
            </button>
          ) : (
            <button
              onClick={check}
              disabled={checking}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 disabled:opacity-60 transition-colors"
            >
              {checking ? t("ctaRechecking") : t("ctaRecheck")}
            </button>
          )}
          <button
            onClick={onTryDemo}
            className="w-full px-4 py-2 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← {t("ctaTryDemo")}
          </button>
        </div>

        <p className="text-center text-[11px] text-zinc-600 mt-5">
          {t("docsHint")}{" "}
          <a
            href="https://github.com/your-org/argos-crm/blob/main/INSTALL.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-500 hover:text-sky-400"
          >
            INSTALL.md ↗
          </a>
        </p>
      </div>
    </div>
  )
}
