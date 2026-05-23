// Helpers de fecha. parseISO existe porque `new Date("2026-05-19")` lo
// interpreta como UTC midnight, lo que en zonas con UTC- corre el día
// hacia atrás. Construir Date con (y, m-1, d) evita el off-by-one.

export function parseISO(iso: string | null | undefined): Date | null {
  if (!iso || typeof iso !== "string") return null
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function fmtDate(iso: string | null | undefined, hora?: string | null): string {
  if (!iso) return "—"
  const d = parseISO(iso)
  if (!d) return "—"
  const base = `${d.getDate()}/${d.getMonth() + 1}`
  return hora ? `${base} ${hora}` : base
}

export function fmtISO(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  )
}
