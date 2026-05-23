// POST /api/google/calendar/events-bulk
// Lista todos los eventos de varios calendarios en una ventana de tiempo.
// Usado por el Planificador para construir la CARGA del equipo real
// (incluyendo eventos NO-etapa que afectan la disponibilidad del equipo).
//
// Body: { calendarIds: [string], timeMin: ISO, timeMax: ISO }
// Returns: { events: [{ calendarId, eventId, summary, date, hora }] }
//
// Solo admin (eventos de calendarios del equipo, info sensible).

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { listEventsBetween } from "@/lib/google"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.calendarIds) || !body.timeMin || !body.timeMax) {
    return NextResponse.json(
      { error: "calendarIds (array), timeMin, timeMax requeridos" },
      { status: 400 }
    )
  }

  // Dedupe + filtra strings vacíos
  const ids: string[] = Array.from(
    new Set((body.calendarIds as unknown[]).filter((s): s is string => typeof s === "string" && s.length > 0)),
  )

  // Fetch en paralelo a Google
  const results = await Promise.all(
    ids.map(async (calId) => {
      const events = await listEventsBetween(calId, body.timeMin, body.timeMax)
      return { calendarId: calId, events }
    }),
  )

  type FlatEvent = { calendarId: string; eventId: string | null | undefined; summary: string; date: string; hora: string | null }
  const allEvents: FlatEvent[] = []
  const errors: string[] = []
  for (const { calendarId, events } of results) {
    if (!events) {
      errors.push(calendarId)
      continue
    }
    for (const e of events) {
      let date: string | null = null
      let hora: string | null = null
      // All-day: start.date (YYYY-MM-DD)
      if (e.start?.date) {
        date = e.start.date
      } else if (e.start?.dateTime) {
        // Timed: YYYY-MM-DDTHH:MM:SS±TZ → tomamos componentes
        const dt: string = e.start.dateTime
        date = dt.slice(0, 10)
        hora = dt.slice(11, 16)
      }
      if (!date) continue
      allEvents.push({
        calendarId,
        eventId: e.id,
        summary: e.summary || "",
        date,
        hora,
      })
    }
  }

  return NextResponse.json({ events: allEvents, errors })
}
