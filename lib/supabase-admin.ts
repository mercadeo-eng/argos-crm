// Cliente Supabase server-only con service_role key.
// NUNCA importar este archivo desde código client-side (componentes con "use client").
// Solo se usa desde route handlers en app/api/.

import { createClient, SupabaseClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRole) {
  console.warn(
    "[supabase-admin] Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"
  )
}

export const supabaseAdmin: SupabaseClient | null =
  url && serviceRole
    ? createClient(url, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null
