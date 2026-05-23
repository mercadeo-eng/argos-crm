// Health check del setup. El SetupWizard llama a esta route para decidir
// qué pasos del checklist ya están done. NO requiere auth (es deliberada-
// mente accesible sin login porque el wizard se muestra antes de que
// haya credenciales).
//
// Devuelve solo flags binarios — no expone los valores de las env vars.

import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseConfigured = !!(supabaseUrl && supabaseAnon && supabaseService)

  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

  let migrationsRan = false
  let hasAdmin = false

  if (supabaseConfigured && supabaseAdmin) {
    try {
      // Tocamos la tabla `profiles` (creada en 003_supabase_auth.sql).
      // Si responde sin error → las migraciones corrieron. Si error 42P01
      // (relation does not exist) → falta correr migraciones.
      const { error } = await supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true })
      migrationsRan = !error
      if (migrationsRan) {
        const { count: adminCount } = await supabaseAdmin
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin")
        hasAdmin = (adminCount || 0) > 0
      }
    } catch {
      // Si la conexión falla del todo, dejamos los flags en false; el
      // wizard mostrará "no se pudo verificar" sin romperse.
    }
  }

  return Response.json({
    supabaseConfigured,
    migrationsRan,
    hasAdmin,
    googleConfigured,
  })
}
