// Helpers de auth server-side. Verifica el JWT del browser y resuelve
// el role del usuario (admin / cliente) vía la tabla profiles.
// Solo usar desde API routes — depende de supabaseAdmin (service_role).

import type { User } from "@supabase/supabase-js"
import { supabaseAdmin } from "./supabase-admin"
import type { Profile } from "./types"

// Discriminated union: o devuelve la sesión resuelta (user + profile) o un
// Response listo para mandar al cliente. Las routes hacen:
//   const r = await getCallerProfile(request)
//   if (r.response) return r.response
//   // ahora r.user y r.profile están disponibles
export type CallerResult =
  | { response: Response; user?: undefined; profile?: undefined }
  | { response?: undefined; user: User; profile: Profile }

function bearerFrom(request: Request): string | null {
  const h = request.headers.get("authorization") || request.headers.get("Authorization")
  if (!h) return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

// Verifica el JWT del request, devuelve { user, profile } o un error.
export async function getCallerProfile(request: Request): Promise<CallerResult> {
  if (!supabaseAdmin) {
    return { response: Response.json({ error: "supabase_admin_not_configured" }, { status: 500 }) }
  }

  const token = bearerFrom(request)
  if (!token) {
    return { response: Response.json({ error: "missing_auth_token" }, { status: 401 }) }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) {
    return { response: Response.json({ error: "invalid_token" }, { status: 401 }) }
  }
  const user = data.user

  const { data: profile, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, role, cliente_id")
    .eq("id", user.id)
    .maybeSingle()
  if (profErr) {
    return { response: Response.json({ error: "profile_lookup_failed" }, { status: 500 }) }
  }
  if (!profile) {
    return { response: Response.json({ error: "no_profile" }, { status: 403 }) }
  }

  return { user, profile: profile as Profile }
}

// Atajo: solo admin pasa. El cliente recibe 403.
export async function requireAdmin(request: Request): Promise<CallerResult> {
  const r = await getCallerProfile(request)
  if (r.response) return r
  if (r.profile.role !== "admin") {
    return { response: Response.json({ error: "not_admin" }, { status: 403 }) }
  }
  return r
}
