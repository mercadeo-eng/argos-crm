import { NextResponse } from "next/server"
import { getCalendarClient } from "@/lib/google"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PANAMA_TZ = "America/Panama"

function nextDay(yyyymmdd: string) {
  const d = new Date(yyyymmdd + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function addHoursToDateTime(date: string, hora: string, hours: number) {
  const [y, m, d] = date.split("-").map(Number)
  const [h, min] = hora.split(":").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, h, min, 0))
  dt.setUTCHours(dt.getUTCHours() + hours)
  return {
    date: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`,
    time: `${String(dt.getUTCHours()).padStart(2, "0")}:${String(dt.getUTCMinutes()).padStart(2, "0")}`,
  }
}

function buildStartEnd(date: string, hora: string | null | undefined, durationHours = 1) {
  if (!hora) {
    return { start: { date }, end: { date: nextDay(date) } }
  }
  const { date: endDate, time: endTime } = addHoursToDateTime(date, hora, durationHours)
  return {
    start: { dateTime: `${date}T${hora}:00`, timeZone: PANAMA_TZ },
    end: { dateTime: `${endDate}T${endTime}:00`, timeZone: PANAMA_TZ },
  }
}

// PATCH /api/google/calendar/events/[id]
// Body: { summary, description?, date, calendarId? }
// calendarId default 'primary' (compat con eventos viejos creados sin él)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: "body requerido" }, { status: 400 })
  }

  const cal = await getCalendarClient()
  if (!cal) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 400 })
  }

  const calendarId = body.calendarId || "primary"

  type PatchBody = {
    summary?: string
    description?: string
    start?: ReturnType<typeof buildStartEnd>["start"]
    end?: ReturnType<typeof buildStartEnd>["end"]
  }
  const requestBody: PatchBody = {}
  if (body.summary) requestBody.summary = body.summary
  if (body.description !== undefined) requestBody.description = body.description
  // body.hora "" (string vacío) significa "quitar hora, volver a all-day"
  if (body.date) {
    const hora = body.hora ? body.hora : null
    const { start, end } = buildStartEnd(body.date, hora)
    requestBody.start = start
    requestBody.end = end
  }

  try {
    const res = await cal.events.patch({
      calendarId,
      eventId: id,
      requestBody,
    })
    return NextResponse.json({
      eventId: res.data.id,
      htmlLink: res.data.htmlLink,
      calendarId,
    })
  } catch (e) {
    const err = e as { errors?: unknown; message?: string }
    console.error("[calendar/events PATCH]", err?.errors || e)
    return NextResponse.json(
      { error: err?.message || "patch_failed" },
      { status: 500 }
    )
  }
}

// DELETE /api/google/calendar/events/[id]?calendarId=...
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const calendarId = new URL(request.url).searchParams.get("calendarId") || "primary"
  const cal = await getCalendarClient()
  if (!cal) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 400 })
  }
  try {
    await cal.events.delete({ calendarId, eventId: id })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const err = e as { code?: number; response?: { status?: number }; errors?: unknown; message?: string }
    if (err?.code === 410 || err?.response?.status === 410) {
      return NextResponse.json({ ok: true, alreadyGone: true })
    }
    console.error("[calendar/events DELETE]", err?.errors || e)
    return NextResponse.json(
      { error: err?.message || "delete_failed" },
      { status: 500 }
    )
  }
}
