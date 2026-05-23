import { NextResponse } from "next/server"
import { buildAuthUrl } from "@/lib/google"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/google/auth → redirige a Google para iniciar OAuth.
// Construye el redirectUri en base al host actual (funciona en prod, preview y local).
export async function GET(request: Request) {
  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/google/callback`
  return NextResponse.redirect(buildAuthUrl(redirectUri))
}
