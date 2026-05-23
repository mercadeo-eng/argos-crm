// DELETE /api/admin/users/[id]
// Elimina cliente + su user en auth.users + cascade limpia profiles, api_keys, notas, ...
// Solo admin.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  // requireAdmin garantiza que supabaseAdmin no es null, pero TS no lo
  // sabe; alias local + non-null assertion para limpiar los call sites.
  const sb = supabaseAdmin!

  const { id: clienteId } = await params
  if (!clienteId) {
    return NextResponse.json({ error: "id_required" }, { status: 400 })
  }

  // 1. Buscar el profile asociado para encontrar el auth.users id
  const { data: profile } = await sb
    .from("profiles")
    .select("id")
    .eq("cliente_id", clienteId)
    .maybeSingle()

  // 2. Borrar el cliente (cascade limpia api_keys, notas, y profile si existe)
  const { error: cliErr } = await sb
    .from("clientes")
    .delete()
    .eq("id", clienteId)
  if (cliErr) {
    console.error("[admin/users DELETE] delete cliente:", cliErr)
    return NextResponse.json({ error: cliErr.message }, { status: 500 })
  }

  // 3. Si había auth user vinculado, eliminarlo también
  if (profile?.id) {
    const { error: userErr } = await sb.auth.admin.deleteUser(profile.id)
    if (userErr) {
      // El cliente ya fue borrado; logueamos pero no rompemos
      console.error("[admin/users DELETE] deleteUser:", userErr)
    }
  }

  return NextResponse.json({ ok: true })
}
