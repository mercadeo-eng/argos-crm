import { NextResponse } from "next/server"
import { exchangeCodeForTokens, saveTokens } from "@/lib/google"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/google/callback → Google redirige aquí después del consent.
// Intercambia el `code` por tokens, guarda en Supabase, redirige a /.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      `${origin}/?google_error=${encodeURIComponent(error)}`
    )
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/?google_error=no_code`)
  }

  try {
    const redirectUri = `${origin}/api/google/callback`
    const { tokens, email } = await exchangeCodeForTokens(code, redirectUri)
    if (!tokens.refresh_token) {
      // Sin refresh_token no podemos mantener la sesión a largo plazo.
      // Esto suele pasar cuando el usuario ya había autorizado antes y
      // Google no re-emite el refresh sin prompt=consent (que ya forzamos
      // en buildAuthUrl, pero por si acaso).
      return NextResponse.redirect(`${origin}/?google_error=no_refresh_token`)
    }
    await saveTokens(tokens, email)
    return NextResponse.redirect(`${origin}/?google_connected=1`)
  } catch (e) {
    console.error("[google/callback]", e)
    const message = e instanceof Error ? e.message : "exchange_failed"
    return NextResponse.redirect(
      `${origin}/?google_error=${encodeURIComponent(message)}`
    )
  }
}
