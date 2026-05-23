"use client"
import { useLocale } from "next-intl"
import { useRouter, usePathname } from "@/i18n/navigation"
import { useTransition } from "react"
import { routing } from "@/i18n/routing"

// Switcher discreto ES | EN. Preserva la ruta actual al cambiar idioma.
export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function switchTo(next: string) {
    if (next === locale || isPending) return
    startTransition(() => {
      router.replace(pathname, { locale: next as (typeof routing.locales)[number] })
    })
  }

  return (
    <div className="flex items-center gap-1 text-[10px]" aria-label="Language">
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          disabled={isPending}
          className={`px-2 py-0.5 rounded uppercase font-semibold tracking-wide transition-colors ${
            locale === l
              ? "bg-zinc-800 text-zinc-200"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
