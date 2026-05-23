import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"

// Next 16 renombró `middleware.ts` → `proxy.ts`. next-intl exporta su
// handler bajo el path histórico /middleware; lo expongo como proxy.
export const proxy = createMiddleware(routing)

export const config = {
  // Matchea todo salvo /api, archivos estáticos, y assets.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
