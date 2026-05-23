"use client"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { supabase } from "@/lib/supabase"
import { Brand } from "../_brand"

// Usa Supabase Auth. La verificación de estado de cliente (pausa/inactivo)
// pasa a hacerse después del login en ArgosCRM, con la data del profile.
export function LoginScreen() {
  const t = useTranslations("auth")
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)

  async function handle() {
    if (!email || !pass) {
      setErr(t("errorMissing"))
      return
    }
    if (!supabase) {
      setErr(t("errorBackend"))
      return
    }
    setLoading(true)
    setErr("")
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
    setLoading(false)
    if (error) {
      const msg = error.message || ""
      setErr(/invalid login/i.test(msg) ? t("errorInvalid") : msg)
    }
    // Si OK: el listener de onAuthStateChange en ArgosCRM detecta la sesión.
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="w-full max-w-sm p-4">
        <div className="mb-10 text-center">
          <Brand className="text-2xl" />
          <p className="text-zinc-500 text-sm mt-2">{t("subtitle")}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">{t("email")}</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handle()}
              autoComplete="email"
              type="email"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500"
              placeholder={t("emailPlaceholder")}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">{t("password")}</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handle()}
              autoComplete="current-password"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button
            onClick={handle}
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? t("submitting") : t("submit")}
          </button>
        </div>
      </div>
    </div>
  )
}
