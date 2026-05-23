// Helpers de OAuth y Google Calendar. Server-only.
// Importa supabaseAdmin → este módulo NO puede llegar al bundle del browser.

import { google, calendar_v3 } from "googleapis"
import type { Credentials } from "google-auth-library"
import { supabaseAdmin } from "./supabase-admin"

// Scopes mínimos:
// - calendar.events: crear/editar/borrar eventos
// - calendar.calendarlist.readonly: listar los calendarios disponibles para
//   el dropdown de selección por cliente. NO lee eventos de otros calendarios.
// - userinfo.email: para mostrar qué cuenta está conectada en la UI
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
]

const SINGLETON_ID = "singleton"

// Token row tal como la persistimos en la tabla google_tokens.
export type GoogleTokenRow = {
  id: string
  access_token: string
  refresh_token: string
  expires_at: string
  scope: string | null
  email: string | null
  updated_at?: string
}

// Forma mínima de un calendario para la UI del Planificador.
export type CalendarSummary = {
  id: string | null | undefined
  summary: string | null | undefined
  primary: boolean
  accessRole: string | null | undefined
  backgroundColor: string | null | undefined
}

function makeOAuth2(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  )
}

// URL a la que redirige /api/google/auth
export function buildAuthUrl(redirectUri: string): string {
  const oauth = makeOAuth2(redirectUri)
  return oauth.generateAuthUrl({
    access_type: "offline", // necesario para recibir refresh_token
    prompt: "consent",      // fuerza re-consent → garantiza refresh_token nuevo
    scope: SCOPES,
    include_granted_scopes: true,
  })
}

// Intercambia el code que devuelve Google por tokens y obtiene el email.
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<{ tokens: Credentials; email: string | null }> {
  const oauth = makeOAuth2(redirectUri)
  const { tokens } = await oauth.getToken(code)
  oauth.setCredentials(tokens)

  const oauth2 = google.oauth2({ version: "v2", auth: oauth })
  const me = await oauth2.userinfo.get()

  return { tokens, email: me.data.email || null }
}

// Persiste tokens en la tabla google_tokens (upsert sobre singleton).
export async function saveTokens(tokens: Credentials, email: string | null): Promise<void> {
  if (!supabaseAdmin) throw new Error("supabaseAdmin no configurado")
  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 3600_000).toISOString()

  const { error } = await supabaseAdmin.from("google_tokens").upsert({
    id: SINGLETON_ID,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    scope: tokens.scope || null,
    email,
  })
  if (error) throw error
}

export async function loadTokens(): Promise<GoogleTokenRow | null> {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from("google_tokens")
    .select("*")
    .eq("id", SINGLETON_ID)
    .maybeSingle()
  if (error) {
    console.error("[google.loadTokens]", error)
    return null
  }
  return (data as GoogleTokenRow | null) ?? null
}

export async function deleteTokens(): Promise<void> {
  if (!supabaseAdmin) return
  const { error } = await supabaseAdmin
    .from("google_tokens")
    .delete()
    .eq("id", SINGLETON_ID)
  if (error) console.error("[google.deleteTokens]", error)
}

// Lista TODOS los eventos de un calendario en una ventana de tiempo.
// Usado por el endpoint events-bulk para alimentar la CARGA real del equipo.
export async function listEventsBetween(
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<calendar_v3.Schema$Event[] | null> {
  const cal = await getCalendarClient()
  if (!cal) return null
  try {
    const { data } = await cal.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      maxResults: 2500,
      orderBy: "startTime",
    })
    return data.items || []
  } catch (e) {
    const err = e as { errors?: unknown }
    console.error(`[listEventsBetween] ${calendarId}:`, err?.errors || e)
    return null
  }
}

// Lista los calendarios donde el usuario conectado puede crear eventos
// (accessRole = 'writer' u 'owner'). Excluye los read-only.
export async function listWritableCalendars(): Promise<CalendarSummary[] | null> {
  const cal = await getCalendarClient()
  if (!cal) return null
  const { data } = await cal.calendarList.list({ maxResults: 250 })
  const items = data.items || []
  const writable = items.filter((c) => c.accessRole === "writer" || c.accessRole === "owner")
  return writable.map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: !!c.primary,
    accessRole: c.accessRole,
    backgroundColor: c.backgroundColor,
  }))
}

// Lista TODOS los calendarios accesibles (owner/writer/reader) — excluye
// freeBusyReader (no muestra contenido) y los pre-filtrados por Google.
// Usado por el Planificador para construir CARGA: queremos contar eventos
// también en calendarios compartidos donde mercadeo@ solo tiene lectura
// (típico de Google Workspace donde un calendario del equipo es read-only).
export async function listAccessibleCalendars(): Promise<CalendarSummary[] | null> {
  const cal = await getCalendarClient()
  if (!cal) return null
  const { data } = await cal.calendarList.list({ maxResults: 250 })
  const items = data.items || []
  const accessible = items.filter((c) => !!c.accessRole && ["owner", "writer", "reader"].includes(c.accessRole))
  return accessible.map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: !!c.primary,
    accessRole: c.accessRole,
    backgroundColor: c.backgroundColor,
  }))
}

// Devuelve un cliente de Google Calendar autenticado y con refresh
// automático. Si los tokens no existen → null.
export async function getCalendarClient(): Promise<calendar_v3.Calendar | null> {
  const stored = await loadTokens()
  if (!stored) return null

  // El redirectUri aquí no se usa para llamadas a la API, solo se requiere
  // para construir el OAuth2 client. Usamos un placeholder cualquiera.
  const oauth = makeOAuth2("http://localhost/unused")
  oauth.setCredentials({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
    expiry_date: new Date(stored.expires_at).getTime(),
    scope: stored.scope ?? undefined,
  })

  // googleapis dispara este evento cuando refresca el access_token.
  // Persistimos los tokens nuevos para que la próxima request no necesite
  // refrescar otra vez (los access_tokens viven ~1h).
  oauth.on("tokens", async (newTokens: Credentials) => {
    try {
      const merged = {
        access_token: newTokens.access_token || stored.access_token,
        refresh_token: newTokens.refresh_token || stored.refresh_token,
        expires_at: newTokens.expiry_date
          ? new Date(newTokens.expiry_date).toISOString()
          : stored.expires_at,
      }
      if (!supabaseAdmin) return
      await supabaseAdmin
        .from("google_tokens")
        .update(merged)
        .eq("id", SINGLETON_ID)
    } catch (e) {
      console.error("[google.tokens-refresh-persist]", e)
    }
  })

  return google.calendar({ version: "v3", auth: oauth })
}
