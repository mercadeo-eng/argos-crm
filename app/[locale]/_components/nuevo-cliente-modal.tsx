"use client"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { stageIds as ETAPAS_ORDEN } from "@/lib/stages"
import type { Cliente, CicloCliente, EstadoCliente, Red } from "@/lib/types"

type CrearPayload = {
  id: string
  cliente: Cliente
  email: string
  password: string
}

type CrearResult = { ok: boolean; error?: string }

type NuevoClienteModalProps = {
  onClose: () => void
  onCrear: (payload: CrearPayload) => Promise<CrearResult>
  clientesExistentes: Record<string, Cliente>
}

type Plataforma = "Instagram" | "Facebook" | "TikTok" | "LinkedIn" | "YouTube"

type FormState = {
  nombre: string
  industria: string
  ciclo: CicloCliente
  estado: EstadoCliente
  color: string
  email: string
  password: string
  redes: Record<Plataforma, boolean>
}

type CreadoSnapshot = {
  id: string
  nombre: string
  email: string
  password: string
  color: string
}

const COLORES: { value: string; name: string }[] = [
  { value: "#0EA5E9", name: "Cielo" },
  { value: "#6366F1", name: "Índigo" },
  { value: "#F59E0B", name: "Ámbar" },
  { value: "#10B981", name: "Esmeralda" },
  { value: "#8B5CF6", name: "Violeta" },
  { value: "#EC4899", name: "Rosa" },
  { value: "#14B8A6", name: "Turquesa" },
  { value: "#D97706", name: "Naranja" },
]

const PLATAFORMAS: Plataforma[] = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube"]

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function genRandomPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let p = ""
  for (let i = 0; i < 10; i++) p += chars.charAt(Math.floor(Math.random() * chars.length))
  return p
}

export function NuevoClienteModal({ onClose, onCrear, clientesExistentes }: NuevoClienteModalProps) {
  const t = useTranslations("newClient")
  const tc = useTranslations("common")
  const tClient = useTranslations("client")
  const ta = useTranslations("auth")

  const [step, setStep] = useState<1 | 2>(1)
  const [creado, setCreado] = useState<CreadoSnapshot | null>(null)
  const [form, setForm] = useState<FormState>({
    nombre: "",
    industria: "",
    ciclo: "mensual",
    estado: "activo",
    color: "#0EA5E9",
    email: "",
    password: "",
    redes: { Instagram: true, Facebook: true, TikTok: false, LinkedIn: false, YouTube: false },
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  function validar(cleaned: FormState): boolean {
    const e: Record<string, string> = {}
    if (!cleaned.nombre) e.nombre = t("errorRequired")
    if (!cleaned.industria) e.industria = t("errorRequired")
    if (!cleaned.email) e.email = t("errorRequired")
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email)) e.email = t("errorEmailInvalid")
    if (!cleaned.password || cleaned.password.length < 6) e.password = t("errorPasswordShort")
    const id = slugify(cleaned.nombre)
    if (cleaned.nombre && clientesExistentes[id]) e.nombre = t("errorNameExists")
    if (Object.values(form.redes).filter(Boolean).length === 0) e.redes = t("errorRedesEmpty")
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    const cleaned: FormState = {
      ...form,
      nombre: form.nombre.trim(),
      industria: form.industria.trim(),
      email: form.email.trim(),
      password: form.password.trim(),
    }
    setForm(cleaned)
    if (!validar(cleaned)) return
    const id = slugify(cleaned.nombre)
    const redes: Red[] = Object.entries(cleaned.redes)
      .filter(([, v]) => v)
      .map(([p]) => ({ plataforma: p, estado: "activo", ultima: "—" }))
    const cliente: Cliente = {
      id,
      nombre: cleaned.nombre,
      industria: cleaned.industria,
      ciclo: cleaned.ciclo,
      estado: cleaned.estado,
      color: cleaned.color,
      redes,
      etapas: ETAPAS_ORDEN.map((e) => ({ etapa: e, fecha: null, estado: "pendiente", calId: false })),
      pautas: null,
    }
    setSubmitting(true)
    setSubmitError("")
    try {
      const result = await onCrear({ id, cliente, email: cleaned.email, password: cleaned.password })
      if (!result?.ok) {
        setSubmitError(result?.error || t("createError"))
        return
      }
      setCreado({ id, nombre: cleaned.nombre, email: cleaned.email, password: cleaned.password, color: cleaned.color })
      setStep(2)
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setForm({
      nombre: "",
      industria: "",
      ciclo: "mensual",
      estado: "activo",
      color: "#0EA5E9",
      email: "",
      password: "",
      redes: { Instagram: true, Facebook: true, TikTok: false, LinkedIn: false, YouTube: false },
    })
    setErrors({})
    setCreado(null)
    setStep(1)
  }

  function toggleRed(p: Plataforma) {
    setForm((f) => ({ ...f, redes: { ...f.redes, [p]: !f.redes[p] } }))
  }

  if (step === 2 && creado) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6">
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">✓</span>
            </div>
            <h2 className="text-lg font-semibold text-white">{t("step2Title")}</h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full" style={{ background: creado.color }} />
              <p className="text-sm text-zinc-400">{creado.nombre}</p>
            </div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
            <span className="text-base">⚠</span>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">{t("step2Warning")}</p>
          </div>
          <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 space-y-2 mb-5">
            <div className="flex items-center justify-between gap-3"><span className="text-[11px] text-zinc-500 uppercase">{tc("email")}</span><span className="text-sm text-zinc-100 font-mono">{creado.email}</span></div>
            <div className="border-t border-zinc-700" />
            <div className="flex items-center justify-between gap-3"><span className="text-[11px] text-zinc-500 uppercase">{ta("password")}</span><span className="text-sm text-zinc-100 font-mono">{creado.password}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 px-4 py-2 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors">{t("step2CreateAnother")}</button>
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm bg-sky-500 hover:bg-sky-400 text-white font-medium transition-colors">{t("step2Close")}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-semibold text-white">{t("title")}</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">{t("subtitle")}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>
        <div className="p-6 space-y-5">
          {Object.keys(errors).length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5">⚠</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-red-300">{t("errorsHeader", { count: Object.keys(errors).length })}</p>
                <p className="text-[11px] text-red-300/70 mt-0.5">{t("errorsHelp")}</p>
              </div>
            </div>
          )}
          <section>
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">{t("section1")}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">{t("nameLabel")}</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className={`w-full bg-zinc-800 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 placeholder-zinc-600 ${errors.nombre ? "border-red-500/50" : "border-zinc-700"}`}
                  placeholder={t("namePlaceholder")}
                />
                {errors.nombre && <p className="text-[11px] text-red-400 mt-1">{errors.nombre}</p>}
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">{t("industryLabel")}</label>
                <input
                  value={form.industria}
                  onChange={(e) => setForm((f) => ({ ...f, industria: e.target.value }))}
                  className={`w-full bg-zinc-800 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 placeholder-zinc-600 ${errors.industria ? "border-red-500/50" : "border-zinc-700"}`}
                  placeholder={t("industryPlaceholder")}
                />
                {errors.industria && <p className="text-[11px] text-red-400 mt-1">{errors.industria}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">{t("cycleLabel")}</label>
                  <select value={form.ciclo} onChange={(e) => setForm((f) => ({ ...f, ciclo: e.target.value as CicloCliente }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                    <option value="mensual">{tClient("cycleMonthly")}</option>
                    <option value="bimestral">{tClient("cycleBimonthly")}</option>
                    <option value="trimestral">{tClient("cycleQuarterly")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">{t("statusLabel")}</label>
                  <select value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as EstadoCliente }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                    <option value="activo">🟢 {tClient("statusActive")}</option>
                    <option value="revision">🔵 {tClient("statusReview")}</option>
                    <option value="pausa">🟡 {tClient("statusPaused")}</option>
                    <option value="inactivo">🔴 {tClient("statusInactive")}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">{t("colorLabel")}</label>
                <div className="flex flex-wrap gap-1.5">
                  {COLORES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                      title={c.name}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c.value ? "border-white scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ background: c.value }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
          <section>
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">{t("section2")}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">{ta("email")}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={`w-full bg-zinc-800 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 placeholder-zinc-600 ${errors.email ? "border-red-500/50" : "border-zinc-700"}`}
                  placeholder={ta("emailPlaceholder")}
                />
                {errors.email && <p className="text-[11px] text-red-400 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">{ta("password")}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className={`flex-1 bg-zinc-800 border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500 placeholder-zinc-600 ${errors.password ? "border-red-500/50" : "border-zinc-700"}`}
                    placeholder={t("passwordPlaceholderShort")}
                  />
                  <button onClick={() => setForm((f) => ({ ...f, password: genRandomPassword() }))} className="px-3 py-2 rounded-lg text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors whitespace-nowrap">🎲 {t("generate")}</button>
                </div>
                {errors.password && <p className="text-[11px] text-red-400 mt-1">{errors.password}</p>}
              </div>
            </div>
          </section>
          <section>
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">{t("section3")}</h3>
            <div className="grid grid-cols-2 gap-2">
              {PLATAFORMAS.map((p) => {
                const icon = p === "Instagram" ? "📷" : p === "Facebook" ? "👤" : p === "TikTok" ? "🎵" : p === "LinkedIn" ? "💼" : "▶️"
                const a = form.redes[p]
                return (
                  <button
                    key={p}
                    onClick={() => toggleRed(p)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${a ? "bg-sky-500/15 border-sky-500/40 text-sky-200" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}
                  >
                    <span className="text-base">{icon}</span>
                    <span className="flex-1 text-left">{p}</span>
                    {a && <span className="text-sky-400">✓</span>}
                  </button>
                )
              })}
            </div>
            {errors.redes && <p className="text-[11px] text-red-400 mt-2">{errors.redes}</p>}
          </section>
        </div>
        <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 px-6 py-3 flex items-center justify-end gap-2">
          {submitError && <span className="text-xs text-red-400 mr-auto">{submitError}</span>}
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 transition-colors">{tc("cancel")}</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 rounded-lg text-sm bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium transition-colors">
            {submitting ? t("submitting") : t("submit")}
          </button>
        </div>
      </div>
    </div>
  )
}
