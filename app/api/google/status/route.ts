import { NextResponse } from "next/server"
import { loadTokens, deleteTokens } from "@/lib/google"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/google/status → si hay tokens guardados, devuelve email + connected:true
export async function GET() {
  const tokens = await loadTokens()
  if (!tokens) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected: true,
    email: tokens.email,
    connectedAt: tokens.updated_at,
  })
}

// DELETE /api/google/status → borra los tokens (desconectar)
export async function DELETE() {
  await deleteTokens()
  return NextResponse.json({ ok: true })
}
