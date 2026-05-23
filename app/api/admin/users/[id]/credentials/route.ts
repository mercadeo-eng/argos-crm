// /api/admin/users/[id]/credentials — operaciones de credenciales del cliente
//   GET:   devuelve el email actual del cliente (sin password obviamente)
//   POST:  asigna credenciales iniciales a un cliente sin acceso aún
//   PATCH: actualiza email y/o password de un cliente ya con acceso
// Solo admin.

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/auth-server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Helper: encuentra el auth user_id ligado a un cliente_id vía profiles.
// Recibe el client como parámetro para que TS no se queje del null check.
async function findAuthUserId(sb: SupabaseClient, clienteId: string): Promise<string | null> {
  const { data } = await sb
    .from("profiles")
    .select("id")
    .eq("cliente_id", clienteId)
    .maybeSingle()
  return data?.id || null
}

// GET — devuelve email actual del usuario ligado al cliente
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  const sb = supabaseAdmin!
  const { id: clienteId } = await params
  const userId = await findAuthUserId(sb, clienteId)
  if (!userId) {
    return NextResponse.json({ error: "cliente_no_access" }, { status: 404 })
  }
  const { data, error } = await sb.auth.admin.getUserById(userId)
  if (error || !data?.user) {
    return NextResponse.json({ error: error?.message || "fetch_failed" }, { status: 500 })
  }
  return NextResponse.json({ email: data.user.email })
}

// PATCH — actualiza email y/o password del usuario ligado al cliente
// Body: { email?, password? } — al menos uno requerido
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  const sb = supabaseAdmin!
  const { id: clienteId } = await params
  const body = await request.json().catch(() => null)
  if (!body || (!body.email && !body.password)) {
    return NextResponse.json(
      { error: "email o password requerido (al menos uno)" },
      { status: 400 }
    )
  }
  if (body.password && body.password.length < 6) {
    return NextResponse.json(
      { error: "password_too_short" },
      { status: 400 }
    )
  }
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return NextResponse.json(
      { error: "invalid_email" },
      { status: 400 }
    )
  }
  const userId = await findAuthUserId(sb, clienteId)
  if (!userId) {
    return NextResponse.json({ error: "cliente_no_access" }, { status: 404 })
  }
  const updates: { email?: string; password?: string; email_confirm?: boolean } = {}
  if (body.email) updates.email = body.email
  if (body.password) updates.password = body.password
  // Como el confirm email está desactivado en el dashboard, el email nuevo
  // queda válido inmediatamente. Si lo activaras, habría que poner
  // email_confirm: true acá para no obligarlo a re-confirmar.
  if (body.email) updates.email_confirm = true

  const { error } = await sb.auth.admin.updateUserById(userId, updates)
  if (error) {
    console.error("[credentials PATCH]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  const sb = supabaseAdmin!

  const { id: clienteId } = await params
  const body = await request.json().catch(() => null)
  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "email y password son requeridos" },
      { status: 400 }
    )
  }
  const { email, password } = body

  // 1. Verificar que el cliente exista
  const { data: cliente } = await sb
    .from("clientes")
    .select("id, data")
    .eq("id", clienteId)
    .maybeSingle()
  if (!cliente) {
    return NextResponse.json({ error: "cliente_not_found" }, { status: 404 })
  }

  // 2. Verificar que no tenga ya credenciales asignadas
  const { data: existingProfile } = await sb
    .from("profiles")
    .select("id")
    .eq("cliente_id", clienteId)
    .maybeSingle()
  if (existingProfile) {
    return NextResponse.json(
      { error: "cliente_already_has_access", userId: existingProfile.id },
      { status: 409 }
    )
  }

  // 3. Crear auth.users
  const { data: created, error: userErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nombre: cliente.data?.nombre || clienteId,
      cliente_id: clienteId,
    },
  })
  if (userErr || !created?.user) {
    console.error("[credentials POST] createUser:", userErr)
    return NextResponse.json(
      { error: userErr?.message || "create_user_failed" },
      { status: 500 }
    )
  }

  // 4. Crear profile
  const { error: profErr } = await sb
    .from("profiles")
    .insert({ id: created.user.id, role: "cliente", cliente_id: clienteId })
  if (profErr) {
    // Rollback: borrar el user que creamos
    await sb.auth.admin.deleteUser(created.user.id)
    console.error("[credentials POST] insert profile:", profErr)
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: created.user.id })
}
