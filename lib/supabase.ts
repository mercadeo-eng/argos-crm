import { createClient, SupabaseClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // No crashee el build si falta; solo avisamos.
  // El hook que use el cliente debe manejar el caso de !supabase.
  console.warn("[supabase] Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null
