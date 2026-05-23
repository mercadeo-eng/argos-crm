import { getTranslations } from "next-intl/server"
import { isDemoMode } from "@/lib/demo-mode"

// Pill fijo arriba a la derecha. Se monta una sola vez desde el layout, no
// requiere envolver cada return. Renderiza null cuando demo mode está off.
export async function DemoBanner() {
  if (!isDemoMode()) return null
  const t = await getTranslations("demoBanner")
  return (
    <div className="pointer-events-none fixed top-3 right-3 z-50 flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-300 backdrop-blur shadow-lg">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      <span>{t("label")}</span>
      <span aria-hidden className="text-amber-500/60">·</span>
      <span className="text-amber-200/70">{t("subtitle")}</span>
    </div>
  )
}
