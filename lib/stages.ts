// Pipeline de etapas configurable. Los defaults coinciden con el flujo
// agencia-de-contenido original; el comprador del template puede override
// con NEXT_PUBLIC_STAGES_JSON (string JSON con un array de Stage).
//
// Ejemplo de override:
//   NEXT_PUBLIC_STAGES_JSON='[{"id":"discovery","label":"Discovery","icon":"🔍"},
//                             {"id":"build","label":"Build","icon":"🛠️","hasDeliverable":true},
//                             {"id":"closed","label":"Closed","icon":"✅"}]'
//
// hasDeliverable: si true, la etapa muestra el botón "Abrir" cuando está
// en estado "listo" (usa el folder de Drive del cliente).

export interface Stage {
  id: string
  label: string
  icon: string
  hasDeliverable?: boolean
}

const DEFAULT_STAGES: Stage[] = [
  { id: "stage-1", label: "Etapa 1", icon: "1️⃣", hasDeliverable: true },
  { id: "stage-2", label: "Etapa 2", icon: "2️⃣", hasDeliverable: true },
  { id: "stage-3", label: "Etapa 3", icon: "3️⃣", hasDeliverable: true },
  { id: "stage-4", label: "Etapa 4", icon: "4️⃣", hasDeliverable: true },
  { id: "stage-5", label: "Etapa 5", icon: "5️⃣" },
]

function parseStagesFromEnv(): Stage[] | null {
  const raw = process.env.NEXT_PUBLIC_STAGES_JSON
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(
        (s) =>
          s &&
          typeof (s as Stage).id === "string" &&
          typeof (s as Stage).label === "string" &&
          typeof (s as Stage).icon === "string",
      )
    ) {
      return parsed as Stage[]
    }
    console.warn("[stages] NEXT_PUBLIC_STAGES_JSON no tiene el shape esperado, uso defaults")
  } catch (e) {
    console.warn("[stages] NEXT_PUBLIC_STAGES_JSON no parsea, uso defaults", e)
  }
  return null
}

export const stages: Stage[] = parseStagesFromEnv() || DEFAULT_STAGES
export const stageIds = stages.map((s) => s.id)
export const stageLabels: Record<string, string> = Object.fromEntries(stages.map((s) => [s.id, s.label]))
export const stageIcons: Record<string, string> = Object.fromEntries(stages.map((s) => [s.id, s.icon]))
export const stagesWithDeliverable = new Set(stages.filter((s) => s.hasDeliverable).map((s) => s.id))

// Estados de cada etapa (no configurables — son los 4 estados del workflow).
export const stageStatusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  listo: "Listo",
  atrasado: "Atrasado",
}

// Capacidad diaria del equipo: cuántas etapas pueden trabajarse en un día
// antes de marcar el día como "cargado" en el heatmap.
export const TEAM_DAILY_CAPACITY = Number(process.env.NEXT_PUBLIC_TEAM_DAILY_CAPACITY) || 8
