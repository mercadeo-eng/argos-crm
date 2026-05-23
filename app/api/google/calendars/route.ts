// GET /api/google/calendars
// Lista los calendarios del Google account conectado.
//   ?access=write (default): solo writer/owner (para dropdowns de selección)
//   ?access=read           : owner + writer + reader (para CARGA, incluye
//                            calendarios compartidos donde solo se puede
//                            leer eventos pero no crearlos)
// Solo admin.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { listWritableCalendars, listAccessibleCalendars } from "@/lib/google"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  const access = new URL(request.url).searchParams.get("access") || "write"
  const calendars = access === "read"
    ? await listAccessibleCalendars()
    : await listWritableCalendars()
  if (calendars === null) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 400 })
  }
  return NextResponse.json({ calendars })
}
