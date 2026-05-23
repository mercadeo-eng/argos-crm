# Argos CRM

A multi-tenant client/project CRM template built for agencies, freelancers
and service teams that juggle multiple clients through a recurring
production pipeline.

Built with Next.js 16 (App Router) + React 19 + Tailwind v4 + Supabase
(auth + Postgres + RLS) + Google Calendar (optional). Internationalized
out of the box in **Spanish and English** with `next-intl`.

---

## ✦ Highlights

- **Demo mode by default** — clone, `npm install`, `npm run dev`, you're
  in. No accounts, no setup. 8 fictional clients seeded in localStorage.
- **Two-sided panels** — admin sees every client; each client only sees
  their own panel (Supabase RLS handles the split).
- **Pipeline heatmap** — every stage of every client on one screen.
- **Date planner** — drag dates per stage, sync to Google Calendar with
  one click (detects manual events to avoid duplicates).
- **Per-client tabs** — Social, Metrics (Meta Ads + Google Ads OAuth),
  Leads, API connectors, Notes with reply threads.
- **i18n ES / EN** with a sidebar locale switcher and locale-aware
  date/number formatting.
- **Branding configurable via env vars** — name, tagline, logo, primary
  module labels (e.g. `Métricas` → `Pautas` → `Ads` → ...).
- **Pipeline stages configurable** — full JSON override for the 8-stage
  default plus per-stage "has deliverable" flag.

## ✦ Tech

| | |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind v4 + DM Sans |
| Auth + DB | Supabase (Postgres + RLS + Auth) |
| External | Google Calendar API (optional) |
| i18n | next-intl 4 — `/es`, `/en`, easy to extend |
| Deploy | Vercel (one-click) |

## ✦ Quick start (demo, no setup)

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The amber pill top-right tells you you're
in demo mode — sign-in is bypassed, data lives in localStorage, every
edit survives the refresh.

## ✦ Production setup

Once you want a real backend:

1. Read [INSTALL.md](./INSTALL.md) for the full step-by-step (Supabase
   project + migrations + admin user + Google OAuth + Vercel).
2. Copy `.env.example` to `.env.local` and fill in the Supabase keys.
3. Set `NEXT_PUBLIC_DEMO_MODE=false`.

That's it.

## ✦ Configuration

Every customization lives in env vars — no code changes needed for the
basics. See [.env.example](./.env.example) for the full list:

- **Branding**: `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_TAGLINE`, `NEXT_PUBLIC_LOGO_URL`
- **Module labels**: `NEXT_PUBLIC_LABEL_METRICS_MODULE`, etc.
- **Pipeline stages**: `NEXT_PUBLIC_STAGES_JSON` with full per-stage control
- **Team capacity**: `NEXT_PUBLIC_TEAM_DAILY_CAPACITY`

## ✦ License

This template is distributed under the Envato Marketplace License.
See [LICENSE](./LICENSE) for details.

## ✦ Changelog

See [CHANGELOG.md](./CHANGELOG.md).
