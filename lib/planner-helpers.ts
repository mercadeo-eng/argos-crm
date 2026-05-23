import { parseISO, fmtISO } from "./format"
import { TEAM_DAILY_CAPACITY } from "./stages"
import type { Cliente } from "./types"

// Sugiere 3 próximas fechas hábiles a partir de un ancla, evitando días
// con carga alta. Lunes a sábado son hábiles; domingo se descarta.
export function suggestDates(anchor: string | null | undefined, busy: Record<string, number> = {}): string[] {
  const results: string[] = []
  const start = anchor ? (parseISO(anchor) || new Date()) : new Date()
  const d = new Date(start)
  let attempts = 0
  while (results.length < 3 && attempts < 30) {
    d.setDate(d.getDate() + 1)
    attempts++
    if (d.getDay() === 0) continue
    const iso = fmtISO(d)
    if ((busy[iso] || 0) < 4) results.push(iso)
  }
  return results
}

// Color del badge de carga según etapas planificadas para un día.
export function loadColor(score: number): string {
  return score >= 5 ? "#EF4444" : score >= 3 ? "#F59E0B" : "#10B981"
}

// Mapa fecha → cantidad de etapas planificadas en ese día.
export function computeBusy(clientes: Record<string, Cliente> | null | undefined): Record<string, number> {
  const busy: Record<string, number> = {}
  if (!clientes) return busy
  for (const c of Object.values(clientes)) {
    for (const e of c.etapas || []) {
      if (e.fecha) busy[e.fecha] = (busy[e.fecha] || 0) + 1
    }
  }
  return busy
}

// Próximos `n` días hábiles (lunes a sábado, excluye domingo). El label
// (weekday) se formatea en el componente consumidor con Intl.DateTimeFormat
// para preservar el locale activo.
//
// CargaDay separa etapas (creadas en el CRM) de "otros" eventos (no-etapa
// en Google Calendar) para poder pintar gráfico de barras apiladas.
export type CargaDay = {
  iso: string
  day: number
  month: number
  etapas: number
  otros: number
  max: number
}

export function computeCarga(
  etapaBusy: Record<string, number>,
  otrosBusy: Record<string, number> = {},
  n = 12
): CargaDay[] {
  const out: CargaDay[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  let attempts = 0
  while (out.length < n && attempts < 90) {
    attempts++
    const dow = cursor.getDay()
    if (dow !== 0) {
      const iso = fmtISO(cursor)
      out.push({
        iso,
        day: cursor.getDate(),
        month: cursor.getMonth() + 1,
        etapas: etapaBusy[iso] || 0,
        otros: otrosBusy[iso] || 0,
        max: TEAM_DAILY_CAPACITY,
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}
