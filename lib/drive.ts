// Helpers de Google Drive + Calendar IDs.

// Extrae el ID de una carpeta de Google Drive a partir de una URL completa
// (https://drive.google.com/drive/folders/{id}?...) o devuelve el input
// tal cual si ya parece un ID limpio. Devuelve "" si no se reconoce.
export function extractDriveFolderId(input: string | null | undefined): string {
  if (!input) return ""
  const s = String(input).trim()
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/)
  if (m) return m[1]
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s
  return ""
}

export function driveFolderUrl(folderId: string | null | undefined): string {
  return folderId ? `https://drive.google.com/drive/folders/${folderId}` : ""
}

// ID determinístico para eventos de Google Calendar, en formato hex para
// cumplir el constraint de Google (chars a-v + 0-9). El encoder ASCII →
// hex usa solo 0-9 + a-f, subconjunto válido.
// Garantiza idempotencia: re-sync con la misma (cliente, etapa) no duplica.
export function deterministicEventId(clienteId: string, etapaKey: string): string {
  const raw = `argoscrm:${clienteId}:${etapaKey}`
  const bytes = new TextEncoder().encode(raw)
  let hex = ""
  for (const b of bytes) hex += b.toString(16).padStart(2, "0")
  return hex
}
