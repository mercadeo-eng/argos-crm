import { branding, brandParts } from "@/lib/branding"

// Wordmark del CRM. Renderiza el logo si NEXT_PUBLIC_LOGO_URL está set,
// si no usa la versión texto "head.tail" (ej. argos.crm).
export function Brand({ className = "text-base" }: { className?: string }) {
  if (branding.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.appName}
        className={`${className} object-contain`}
      />
    )
  }
  const { head, tail } = brandParts()
  return (
    <span className={`${className} font-semibold text-white tracking-tight`}>
      {head}
      {tail && (
        <>
          <span className={branding.accentClass}>.</span>
          {tail}
        </>
      )}
    </span>
  )
}
