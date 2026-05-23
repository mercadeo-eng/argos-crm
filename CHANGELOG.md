# Changelog

All notable changes to Argos CRM are documented in this file.
This project follows [Semantic Versioning](https://semver.org/).

## [0.1.0] — Initial template release

### Added
- Demo mode (`NEXT_PUBLIC_DEMO_MODE=true` by default): bypass auth,
  seed 8 fictional clients with 6 months of historic data, persist
  every edit to localStorage. Lets buyers preview the product before
  configuring Supabase.
- Branding configurable via env vars: app name, tagline, optional logo
  URL.
- Module label overrides for the metrics/ads section
  (`NEXT_PUBLIC_LABEL_METRICS_MODULE`, `_GLOBAL`, `_REPORT_TITLE`).
- Pipeline stages fully configurable via `NEXT_PUBLIC_STAGES_JSON`.
  Default: 8-stage content-agency pipeline; bring your own with id,
  label, icon and optional `hasDeliverable` flag.
- Team daily capacity configurable
  (`NEXT_PUBLIC_TEAM_DAILY_CAPACITY`).
- i18n with `next-intl` 4 — Spanish and English shipped, locale
  switcher in the sidebar, URLs prefixed with `/es` and `/en`,
  locale-aware date and number formatting throughout.
- Pipeline heatmap, date planner with Google Calendar sync, per-client
  panel with Social / Metrics / API / Leads / Notes tabs, multi-tenant
  Supabase Auth with row-level security split between `admin` and
  `cliente` roles.
- `.env.example`, `README.md`, `INSTALL.md` for installation and
  customization.

### Removed
- All references to the original agency that owned the source code
  (name, email, drive folder URLs, real client data, real ad account
  IDs, real Drive doc IDs).
- ~140 LOC of dead-code datasets (`CLIENTES_DATA`, `DRIVE_INDEX` and
  the two helpers that depended on them).
- Hardcoded Spanish day-of-week labels — now via
  `Intl.DateTimeFormat`.

### Known limitations
- The main `app/[locale]/page.tsx` is still a ~2.5k-line client
  component with `@ts-nocheck` and `eslint-disable` (carried over from
  the original artifact). A refactor into typed sub-components is on
  the roadmap.
- `~50` strings inside the Informe Cliente / Informe Global modals are
  still hardcoded in Spanish; the rest of the surface (~300 strings)
  is fully extracted.
