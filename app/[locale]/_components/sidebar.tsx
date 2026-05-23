"use client"
import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Brand } from "../_brand"
import { LocaleSwitcher } from "../_locale-switcher"
import { labels as appLabels } from "@/lib/labels"
import type { Cliente, EstadoCliente } from "@/lib/types"

type SidebarProps = {
  activePage: string
  onNavigate: (page: string) => void
  onLogout: () => void
  clientes: Record<string, Cliente>
  onNuevoCliente: () => void
}

const DOT: Record<EstadoCliente, string> = {
  activo: "bg-emerald-400",
  pausa: "bg-amber-400",
  revision: "bg-sky-400",
  inactivo: "bg-red-400",
}

export function Sidebar({ activePage, onNavigate, onLogout, clientes, onNuevoCliente }: SidebarProps) {
  const t = useTranslations("nav")
  const lista = Object.values(clientes)
  const navItem = (id: string, label: ReactNode, icon: string) => (
    <button
      key={id}
      onClick={() => onNavigate(id)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
        activePage === id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  )
  return (
    <aside className="w-52 bg-zinc-950 border-r border-zinc-800/60 flex flex-col h-screen flex-shrink-0">
      <div className="p-4 border-b border-zinc-800/60">
        <Brand />
      </div>
      <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
        {navItem("dashboard", t("dashboard"), "⬛")}
        {navItem("planificador", t("planner"), "📅")}
        {navItem("pautas", appLabels.metricsModuleGlobal ?? t("metricsGlobal"), "📊")}
        <div className="pt-3 pb-1 px-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{t("clientsHeader")}</span>
          <span className="text-[10px] text-zinc-600">{lista.length}</span>
        </div>
        {lista.map((c) => (
          <button
            key={c.id}
            onClick={() => onNavigate(`cliente:${c.id}`)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
              activePage === `cliente:${c.id}` ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT[c.estado] || "bg-zinc-500"}`} />
            <span className="truncate font-medium">{c.nombre}</span>
          </button>
        ))}
        <button
          onClick={onNuevoCliente}
          className="w-full flex items-center gap-2 px-3 py-1.5 mt-2 rounded-lg text-sm text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 border border-dashed border-zinc-800 hover:border-sky-500/30 transition-all"
        >
          <span className="text-base leading-none">+</span>
          <span className="font-medium">{t("newClient")}</span>
        </button>
      </nav>
      <div className="p-2.5 border-t border-zinc-800/60 space-y-1">
        <div className="px-3 py-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{t("language")}</span>
          <LocaleSwitcher />
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-zinc-500 hover:text-zinc-300 text-sm rounded-lg hover:bg-zinc-800/50 transition-all"
        >
          <span>↩</span> {t("logout")}
        </button>
      </div>
    </aside>
  )
}
