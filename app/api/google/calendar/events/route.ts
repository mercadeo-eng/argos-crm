import { NextResponse } from "next/server"
import { getCalendarClient } from "@/lib/google"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Para un evento all-day en Google Calendar, end.date es EXCLUSIVO.
// Si la etapa es el 2026-05-20, end debe ser 2026-05-21.
function nextDay(yyyymmdd: string) {
  const d = new Date(yyyymmdd + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

const PANAMA_TZ = "America/Panama"

// Suma horas a una fecha+hora y devuelve { date, time } resultante.
// Usa Date.UTC para evitar TZ del runtime; las componentes son aritmética pura.
function addHoursToDateTime(date: string, hora: string, hours: number) {
  const [y, m, d] = date.split("-").map(Number)
  const [h, min] = hora.split(":").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, h, min, 0))
  dt.setUTCHours(dt.getUTCHours() + hours)
  const ny = dt.getUTCFullYear()
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const nd = String(dt.getUTCDate()).padStart(2, "0")
  const nh = String(dt.getUTCHours()).padStart(2, "0")
  const nmin = String(dt.getUTCMinutes()).padStart(2, "0")
  return { date: `${ny}-${nm}-${nd}`, time: `${nh}:${nmin}` }
}

// Construye los objetos start/end de Google Calendar según si hay hora o no.
// Sin hora → evento all-day (start.date / end.date EXCLUSIVO al siguiente día).
// Con hora → evento timed, 1h de duración, en zona horaria de Panamá.
function buildStartEnd(date: string, hora: string | null | undefined, durationHours = 1) {
  if (!hora) {
    return {
      start: { date },
      end: { date: nextDay(date) },
    }
  }
  const { date: endDate, time: endTime } = addHoursToDateTime(date, hora, durationHours)
  return {
    start: { dateTime: `${date}T${hora}:00`, timeZone: PANAMA_TZ },
    end: { dateTime: `${endDate}T${endTime}:00`, timeZone: PANAMA_TZ },
  }
}

// POST /api/google/calendar/events
// Body: { summary, description?, date (YYYY-MM-DD), calendarId?, eventId? }
// Crea un evento all-day en el calendario indicado (default 'primary').
// Si se manda eventId determinístico y Google retorna 409 (ya existe), hace
// PATCH automáticamente sobre el mismo eventId — efectivamente un upsert.
// Esto previene duplicados aunque el calId tracking del cliente se pierda.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || !body.summary || !body.date) {
    return NextResponse.json(
      { error: "summary y date son requeridos" },
      { status: 400 }
    )
  }

  const cal = await getCalendarClient()
  if (!cal) {
    return NextResponse.json(
      { error: "google_not_connected" },
      { status: 400 }
    )
  }

  const calendarId = body.calendarId || "primary"
  const { start, end } = buildStartEnd(body.date, body.hora || null)
  type EventBody = {
    summary: string
    description: string
    start: ReturnType<typeof buildStartEnd>["start"]
    end: ReturnType<typeof buildStartEnd>["end"]
    id?: string
  }
  const eventBody: EventBody = {
    summary: body.summary,
    description: body.description || "Creado desde Argos CRM",
    start,
    end,
  }
  if (body.eventId) eventBody.id = body.eventId

  try {
    const res = await cal.events.insert({
      calendarId,
      requestBody: eventBody,
    })
    return NextResponse.json({
      eventId: res.data.id,
      htmlLink: res.data.htmlLink,
      calendarId,
    })
  } catch (e) {
    const err = e as { code?: number; response?: { status?: number }; errors?: unknown; message?: string }
    const status = err?.code || err?.response?.status
    // 409 Conflict = ya existe un evento con ese ID. Convertimos en PATCH.
    if (status === 409 && body.eventId) {
      try {
        const res = await cal.events.patch({
          calendarId,
          eventId: body.eventId,
          requestBody: {
            summary: eventBody.summary,
            description: eventBody.description,
            start: eventBody.start,
            end: eventBody.end,
          },
        })
        return NextResponse.json({
          eventId: res.data.id,
          htmlLink: res.data.htmlLink,
          calendarId,
          upserted: true,
        })
      } catch (patchErr) {
        const pErr = patchErr as { errors?: unknown; message?: string }
        console.error("[calendar/events POST upsert PATCH]", pErr?.errors || patchErr)
        return NextResponse.json(
          { error: pErr?.message || "upsert_patch_failed" },
          { status: 500 }
        )
      }
    }
    console.error("[calendar/events POST]", err?.errors || e)
    return NextResponse.json(
      { error: err?.message || "insert_failed" },
      { status: 500 }
    )
  }
}
