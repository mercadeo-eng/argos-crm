// Identidad visual del CRM. Los defaults aplican cuando el comprador no
// override-ea con env vars. Mover a este módulo evita strings hardcoded
// regados por la app.

export type Branding = {
  appName: string
  appTagline: string
  logoUrl: string
  accentClass: string
}

export const branding: Branding = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Argos CRM",
  appTagline: process.env.NEXT_PUBLIC_APP_TAGLINE || "CRM para agencias y equipos",
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || "",
  // El color del punto en el wordmark. Tailwind class. Para personalización
  // dinámica real (no preconfigurada) habrá que mover a CSS vars en una
  // fase posterior — los class names de Tailwind necesitan ser literales.
  accentClass: "text-sky-400",
}

// Parte el appName en cabeza + cola para renderizar el wordmark estilo
// "argos.crm" (head + accent + tail). Si el nombre es de una sola palabra,
// devuelve tail = null.
export function brandParts(): { head: string; tail: string | null } {
  const lower = branding.appName.toLowerCase().trim()
  const parts = lower.split(/\s+/).filter(Boolean)
  return {
    head: parts[0] || "app",
    tail: parts.length > 1 ? parts.slice(1).join("") : null,
  }
}
