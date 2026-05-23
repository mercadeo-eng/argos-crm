import { isDemoMode } from "./demo-mode"
import { DEMO_HISTORICO } from "./demo-seed"
import type { Historico } from "./types"

// Histórico de métricas por cliente. En demo, datos anónimos preconfigurados;
// en producción real debería poblarse desde la integración con Meta /
// Google Ads. Centralizado acá para que tanto el monolito como los modales
// de Informe lo importen de un solo sitio.
export const HISTORICO: Historico = isDemoMode() ? (DEMO_HISTORICO as Historico) : {}
