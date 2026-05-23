// POST /api/google/calendar/find-matches
// Busca en el calendario indicado eventos cuyo título matchee el patrón
// "{cliente} <dash> {etapa}..." — útil para detectar eventos que el admin
// creó manualmente en Google (usualmente con guión corto "-" en vez del
// em-dash "—" que usa el CRM).
//
// Body: { calendarId, clienteNombre, etapas: [{ key, label }] }
// Returns: { [etapaKey]: eventId | null }

import { NextResponse } from "next/server"
import type { calendar_v3 } from "googleapis"
import { requireAdmin } from "@/lib/auth-server"
import { getCalendarClient } from "@/lib/google"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Lowercase + strip accents + normalize dashes a "-" + collapse whitespace
function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacriticals
    .replace(/[–—\-]/g, "-") // em-dash, en-dash, hyphen → "-"
    .replace(/\s+/g, " ")
    .trim()
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  if (!body?.calendarId || !body?.clienteNombre || !Array.isArray(body?.etapas)) {
    return NextResponse.json(
      { error: "calendarId, clienteNombre, etapas requeridos" },
      { status: 400 }
    )
  }

  const cal = await getCalendarClient()
  if (!cal) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 400 })
  }

  // Ventana: 6 meses atrás → 12 meses adelante. Cubre casi todo caso real
  // de etapas planificadas. timeMin/timeMax requieren formato RFC3339.
  const now = new Date()
  const timeMin = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString()
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 12, 1).toISOString()

  let events: calendar_v3.Schema$Event[] = []
  try {
    const { data } = await cal.events.list({
      calendarId: body.calendarId,
      q: body.clienteNombre, // full-text search en summary + description
      timeMin,
      timeMax,
      singleEvents: true,
      maxResults: 250,
    })
    events = data.items || []
  } catch (e) {
    const err = e as { errors?: unknown; message?: string }
    console.error("[find-matches]", err?.errors || e)
    return NextResponse.json(
      { error: err?.message || "search_failed" },
      { status: 500 }
    )
  }

  type EtapaInput = { key: string; label: string }

  // Para cada etapa pedida, busca el primer evento cuyo título normalizado
  // empiece por "{cliente} - {etapa}" seguido de fin de string, espacio,
  // dash o ":". Esto evita falsos positivos como "pre-produccion" matchear
  // contra eventos de "produccion".
  const clienteN = normalize(body.clienteNombre)
  const result: Record<string, string | null> = {}
  for (const { key, label } of body.etapas as EtapaInput[]) {
    const labelN = normalize(label)
    const target = `${clienteN} - ${labelN}`
    const re = new RegExp(`^${escapeRegex(target)}(?:\\s|-|:|$)`)
    const match = events.find((e) => re.test(normalize(e.summary || "")))
    result[key] = match?.id || null
  }

  return NextResponse.json(result)
}
