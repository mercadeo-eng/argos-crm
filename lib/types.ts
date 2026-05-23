// Tipos compartidos del CRM. Centralizar acá evita redefinir shapes en
// cada componente y permite que el monolito empiece a tener TypeScript
// de verdad sin reescribirlo entero de una vez.

export type EstadoCliente = "activo" | "pausa" | "revision" | "inactivo"
export type EstadoEtapa = "pendiente" | "en_curso" | "listo" | "atrasado"
export type CicloCliente = "mensual" | "bimestral" | "trimestral"
export type Rol = "admin" | "cliente"

export type Red = {
  plataforma: string
  estado: string
  ultima: string
}

export type Etapa = {
  etapa: string
  fecha: string | null
  estado: EstadoEtapa
  // calId: false cuando no hay evento, string con el id de Google Calendar
  // cuando ya está sincronizado, true como flag legacy del seed.
  calId: boolean | string
  hora?: string | null
  calCalendarId?: string
}

export type PautaMeta = {
  alcance?: number
  ctr: number
  costo: number
  roas: number | null
  cpr: number
}

export type PautaGoogle = {
  alcance?: number
  ctr: number
  costo: number
  conversiones: number
}

export type Pauta = {
  meta?: PautaMeta | null
  google?: PautaGoogle | null
}

export type Leads = {
  total: number
  referidos: number
  inversion: number
  ganancia: number
  roi: number
}

export type Cliente = {
  id: string
  nombre: string
  industria: string
  ciclo: CicloCliente
  estado: EstadoCliente
  color: string
  redes: Red[]
  etapas: Etapa[]
  pautas: Pauta | null
  tieneLeads?: boolean
  leads?: Leads
  driveFolderId?: string | null
  calendarId?: string
}

export type Nota = {
  id: string
  autor: Rol
  texto: string
  fecha: string
  replyToId?: string | null
}

export type Profile = {
  id: string
  role: Rol
  cliente_id: string | null
}

export type MetaConnection = {
  accountName: string
  accountId: string
  pageName: string
  pageId: string
  scope: string[]
  token: string
  expiresAt: string
}

export type GoogleConnection = {
  accountName: string
  customerId: string
  managerAccount: string
  scope: string[]
  developerToken: string
  refreshToken: string
  connectedAt: string
}

export type ApiKeys = {
  meta?: MetaConnection | null
  google?: GoogleConnection | null
}

// Mapa cliente_id → { userId, role } que devuelve loadAll() para que la
// UI sepa qué clientes ya tienen credenciales asignadas.
export type ProfilesByCliente = Record<string, { userId: string; role: Rol }>

// Forma del state global que loadAll() devuelve.
export type CrmState = {
  clientes: Record<string, Cliente>
  apiKeys: Record<string, ApiKeys>
  notasGlobal: Record<string, Nota[]>
  profilesByCliente: ProfilesByCliente
}

// Histórico mensual de métricas por cliente. Campos extra de demo
// (impresiones, interacciones, seguidores) son opcionales — la integración
// real con Meta/Google Ads puede no devolverlos todos.
export type HistoricoMeta = PautaMeta & {
  impresiones?: number
  interacciones?: number
  seguidores?: number
}

export type HistoricoGoogle = PautaGoogle & {
  impresiones?: number
  visualizaciones?: number
}

export type HistoricoEntry = {
  mes: string
  meta: HistoricoMeta | null
  google: HistoricoGoogle | null
}

export type Historico = Record<string, HistoricoEntry[]>
