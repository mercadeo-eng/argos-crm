// POST /api/admin/users
// Crea un cliente nuevo + usuario en auth.users + profile que los liga.
// Solo accesible para usuarios con role = 'admin' (verificado via JWT).
//
// Body esperado: { id, cliente, email, password }
//   - id: slug del cliente (ej. "acme-corp")
//   - cliente: objeto completo del cliente (nombre, industria, ciclo, etapas, redes...)
//   - email / password: credenciales para auth.users

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  // requireAdmin garantiza que supabaseAdmin no es null; alias + assertion.
  const sb = supabaseAdmin!

  const body = await request.json().catch(() => null)
  if (!body?.id || !body?.cliente || !body?.email || !body?.password) {
    return NextResponse.json(
      { error: "id, cliente, email y password son requeridos" },
      { status: 400 }
    )
  }
  const { id, cliente, email, password } = body

  // 1. Verificar que no exista ya un cliente con ese id
  const { data: existing } = await sb
    .from("clientes")
    .select("id")
    .eq("id", id)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: "cliente_already_exists" }, { status: 409 })
  }

  // 2. Crear el usuario en auth.users (con email_confirm: true → puede entrar inmediato)
  const { data: created, error: userErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: cliente.nombre, cliente_id: id },
  })
  if (userErr || !created?.user) {
    console.error("[admin/users POST] createUser:", userErr)
    return NextResponse.json(
      { error: userErr?.message || "create_user_failed" },
      { status: 500 }
    )
  }
  const authUserId = created.user.id

  // 3. Insertar el cliente
  const { error: cliErr } = await sb
    .from("clientes")
    .insert({ id, data: cliente })
  if (cliErr) {
    // Rollback: borrar el auth user que ya creamos
    await sb.auth.admin.deleteUser(authUserId)
    console.error("[admin/users POST] insert cliente:", cliErr)
    return NextResponse.json({ error: cliErr.message }, { status: 500 })
  }

  // 4. Insertar el profile
  const { error: profErr } = await sb
    .from("profiles")
    .insert({ id: authUserId, role: "cliente", cliente_id: id })
  if (profErr) {
    // Rollback parcial
    await sb.from("clientes").delete().eq("id", id)
    await sb.auth.admin.deleteUser(authUserId)
    console.error("[admin/users POST] insert profile:", profErr)
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, clienteId: id, userId: authUserId })
}
