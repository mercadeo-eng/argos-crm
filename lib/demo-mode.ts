// Demo mode: cuando está activo, la app corre sin Supabase ni Google reales.
// El admin entra sin login, los datos viven en localStorage, y las llamadas
// a backend caen en mocks. El comprador desactiva este flag con
// NEXT_PUBLIC_DEMO_MODE=false al configurar su propia infra.

import type { Profile } from "./types"

export const isDemoMode = (): boolean =>
  process.env.NEXT_PUBLIC_DEMO_MODE !== "false"

export const DEMO_PROFILE: Profile = {
  id: "demo-admin",
  role: "admin",
  cliente_id: null,
}

// Shape mínima que el componente raíz necesita del Session object real.
// No replicamos el tipo completo de @supabase/supabase-js — solo lo que
// tocamos.
export type DemoSession = {
  user: { id: string; email: string }
  access_token: string
}

export const DEMO_SESSION: DemoSession = {
  user: {
    id: "demo-admin",
    email: "admin@argos.local",
  },
  access_token: "demo-token",
}

export const DEMO_STORAGE_KEY = "argos.demo.state.v1"
