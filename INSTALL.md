# Installing Argos CRM

This guide walks you from a fresh clone to a deployed production CRM.
You can run the template in **two modes**:

1. **Demo mode** (default) — no backend, no accounts, data in
   localStorage. Great for evaluating and customizing the UI.
2. **Production mode** — Supabase (auth + database with row-level
   security) plus optional Google Calendar sync.

---

## 1. Requirements

- Node.js 20+ and npm 10+
- A Supabase account (free tier is fine) — only needed for production
- A Google Cloud project (only needed if you want Calendar sync)
- A Vercel account (or any host that runs Next.js 16) — only needed for
  deployment

## 2. Local install — demo mode

```bash
git clone <your-fork-url> argos-crm
cd argos-crm
npm install
npm run dev
```

Open <http://localhost:3000>. You'll see the amber **Demo mode** pill
top-right; sign-in is skipped, 8 fictional clients are seeded, every
edit you make survives the refresh (stored in `localStorage` under
`argos.demo.state.v1`).

To clear the demo state and start over, run this in the browser console:

```js
localStorage.removeItem('argos.demo.state.v1'); location.reload()
```

## 3. Production mode

### 3.1 Create your Supabase project

1. Go to <https://supabase.com> → **New project**.
2. Wait for the database to provision (~1 minute).
3. **Authentication → Providers → Email** — switch off "Confirm email"
   (this template assumes admin-issued credentials, no email confirmation
   loop). Save.

### 3.2 Run the migrations

The schema lives in `supabase/migrations/*.sql`. Open Supabase Dashboard
→ **SQL Editor** → **New query**, then paste and run each file **in
order**:

1. `001_initial.sql` — tables `clientes`, `user_creds`, `api_keys`, `notas` and permissive RLS placeholders.
2. `002_google_tokens.sql` — singleton `google_tokens` table (RLS denies all anon access; only service_role can read/write).
3. `003_supabase_auth.sql` — `profiles` table linking `auth.users` to a role (`admin` / `cliente`) and a `cliente_id`. Two helpers `is_admin()` and `current_cliente_id()` for RLS.
4. `004_tighten_rls.sql` — drops the permissive policies from step 1 and replaces them with per-role policies based on the helpers from step 3.

> Run `004` **only after** you've deployed code that depends on Supabase
> Auth (i.e. once `NEXT_PUBLIC_DEMO_MODE=false`). Running it earlier
> blocks anon access and breaks demo-mode reads.

### 3.3 Create the first admin user

This template ships without a default admin (it would be a security
hole). Supabase doesn't allow creating users via SQL — you must use the
dashboard so the matching row in `auth.identities` gets created.

1. Supabase Dashboard → **Authentication → Users → Add user → Create new user**.
2. Fill in an admin email and password. Tick **Auto Confirm User**. Save.
3. Run this SQL once to promote that user to admin:

   ```sql
   insert into public.profiles (id, role, cliente_id)
   select id, 'admin', null
   from auth.users
   where email = '<your-admin-email>'
   on conflict (id) do update set role = 'admin', cliente_id = null;
   ```

### 3.4 Wire the env vars

Copy the example file:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
NEXT_PUBLIC_DEMO_MODE=false

NEXT_PUBLIC_SUPABASE_URL=https://YOURPROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Restart `npm run dev`. The demo pill disappears, you land on the login
screen, and you sign in with the admin credentials you created in 3.3.

### 3.5 (Optional) Google Calendar sync

If you want the Planner to push stage dates to a Google Calendar:

1. Go to <https://console.cloud.google.com> → create or pick a project.
2. **APIs & Services → Library** — enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** — choose External, fill in
   the basics, add scope `https://www.googleapis.com/auth/calendar` and
   `https://www.googleapis.com/auth/calendar.events`.
4. **APIs & Services → Credentials → Create credentials → OAuth client
   ID** — application type **Web application**.
   - Authorized redirect URI: `http://localhost:3000/api/google/callback`
     for local development. Add the production URL as well once you
     deploy.
5. Add the values to `.env.local`:

   ```env
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```
6. Restart. The Planner now shows a **Connect Google Calendar** button.

If you skip this section the calendar features simply stay disabled —
the rest of the CRM works fine.

## 4. Deploy to Vercel

1. Push your repo to GitHub.
2. <https://vercel.com/new> → import the repo.
3. Vercel auto-detects Next.js. Under **Environment variables**, paste
   every value from your `.env.local`. Make sure `NEXT_PUBLIC_DEMO_MODE`
   is `false` for production.
4. Deploy. Once it's live, copy the deployment URL.
5. Update the Google OAuth credentials in step 3.5 to add
   `https://your-vercel-url.vercel.app/api/google/callback` as an
   authorized redirect URI.

## 5. Customization

All non-trivial customization is env-var-driven so you can change things
without touching code. See `.env.example` for the full reference. Quick
hits:

| What you want | Env var |
|---|---|
| Rename the app | `NEXT_PUBLIC_APP_NAME` |
| Swap the wordmark for a logo image | `NEXT_PUBLIC_LOGO_URL` |
| Change "Métricas" / "Pautas" / "Metrics" / etc. | `NEXT_PUBLIC_LABEL_METRICS_MODULE`, `_GLOBAL`, `_REPORT_TITLE` |
| Replace the pipeline stages | `NEXT_PUBLIC_STAGES_JSON` |
| Change daily team capacity in the heatmap | `NEXT_PUBLIC_TEAM_DAILY_CAPACITY` |
| Add a third language | Drop `messages/<locale>.json` and add the locale to `i18n/routing.ts` |

For deeper customization (new tabs, new stage workflows, etc.) the main
component is `app/[locale]/page.tsx` and the lib modules in `lib/`
(`branding.ts`, `stages.ts`, `labels.ts`, `demo-seed.ts`).

## 6. Troubleshooting

**"database error querying schema" when I try to sign in**
You created the user via SQL instead of the dashboard. Delete the row
from `auth.users` and recreate the user from **Authentication → Users**.

**The demo pill won't go away after I set DEMO_MODE=false**
Restart `npm run dev` — env vars are read at boot, not at runtime.

**Google Calendar sync says "Sin cambios para sincronizar" but I edited dates**
Make sure you clicked **Save** on each edited row before pressing
**Sync Google Calendar**.

**Type errors on `app/[locale]/page.tsx`**
The original artifact ships with `@ts-nocheck` and `ignoreBuildErrors:
true`. We're tracking a refactor to remove both; until then the build
succeeds but `tsc --noEmit` will complain. Safe to ignore.
