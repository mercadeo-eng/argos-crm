-- ════════════════════════════════════════════════════════════════════════════
-- Argos CRM — google_tokens (singleton)
-- ════════════════════════════════════════════════════════════════════════════
-- Pega este archivo en Supabase Dashboard → SQL Editor → New query → Run.
-- Es idempotente.
--
-- Una sola fila (id = 'singleton') almacena el refresh_token de la cuenta
-- de Google conectada a Argos CRM. RLS bloquea TODO acceso vía anon key;
-- solo el service_role (server-only en API routes) puede leer/escribir.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.google_tokens (
  id              text primary key default 'singleton',
  access_token    text not null,
  refresh_token   text not null,
  expires_at      timestamptz not null,
  scope           text,
  email           text,
  updated_at      timestamptz not null default now(),
  constraint singleton_only check (id = 'singleton')
);

-- RLS habilitado sin ninguna policy = inaccessible vía anon key.
-- El service_role key bypassea RLS, así que las API routes server-side
-- siguen pudiendo leer/escribir.
alter table public.google_tokens enable row level security;

-- Trigger reutiliza la función touch_updated_at() del schema 001.
drop trigger if exists touch_google_tokens on public.google_tokens;
create trigger touch_google_tokens
  before update on public.google_tokens
  for each row execute function public.touch_updated_at();
