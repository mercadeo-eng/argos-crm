import type { ReactNode } from "react"

export type BadgeColor = "green" | "blue" | "amber" | "red" | "purple" | "gray"

export function Badge({ children, color = "gray" }: { children: ReactNode; color?: BadgeColor }) {
  const colors: Record<BadgeColor, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-sky-50 text-sky-700 border-sky-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-violet-50 text-violet-700 border-violet-200",
    gray: "bg-zinc-100 text-zinc-500 border-zinc-200",
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${colors[color]}`}
    >
      {children}
    </span>
  )
}

// Helper que pinta un Badge según el estado. Mantenido como función (no
// componente) para no romper los call sites del monolito que ya lo usan
// como `{estadoBadge(x)}`. TODO i18n: traducir labels via t() — por
// ahora siguen en español; cuando se internacionalice se convierte a
// componente <EstadoBadge estado={x} /> que pueda usar useTranslations.
export function estadoBadge(estado: string) {
  const map: Record<string, [string, BadgeColor]> = {
    activo: ["Activo", "green"],
    pausa: ["En pausa", "amber"],
    revision: ["En revisión", "blue"],
    inactivo: ["Inactivo", "red"],
    listo: ["Listo", "green"],
    en_curso: ["En curso", "blue"],
    atrasado: ["Atrasado", "red"],
    pendiente: ["Pendiente", "gray"],
    pausado: ["Pausado", "amber"],
  }
  const [label, color] = map[estado] || [estado, "gray" as BadgeColor]
  return <Badge color={color}>{label}</Badge>
}

export function Metric({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string
  value: string | number
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
      <p className="text-[11px] text-zinc-400 mb-1 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold ${valueColor || "text-zinc-900"}`}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-400 mt-1">{sub}</p>}
    </div>
  )
}
