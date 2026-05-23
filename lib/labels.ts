// Labels visibles configurables. Mantiene neutros los términos del template;
// el comprador override-a con env vars si quiere terminología sectorial
// (ej. "Pautas" para agencia, "Campaigns" para SaaS).
//
// Términos técnicos estándar de industria (ROAS, CTR, CPR, etc.) quedan
// hardcoded — son universales en quien trabaja con ads.

// Devuelven null cuando no hay override → el componente usa la traducción i18n
// como fallback (t('nav.metricsGlobal'), etc.). Esto da al comprador la opción
// de "fijar" un label sin importar el idioma.
export type AppLabels = {
  metricsModule: string | null
  metricsModuleGlobal: string | null
  reportTitle: string | null
}

export const labels: AppLabels = {
  metricsModule: process.env.NEXT_PUBLIC_LABEL_METRICS_MODULE || null,
  metricsModuleGlobal: process.env.NEXT_PUBLIC_LABEL_METRICS_MODULE_GLOBAL || null,
  reportTitle: process.env.NEXT_PUBLIC_LABEL_REPORT_TITLE || null,
}
