-- ════════════════════════════════════════════════════════════════════════════
-- Argos CRM — schema inicial
-- ════════════════════════════════════════════════════════════════════════════
-- Pega este archivo completo en:
--   Supabase Dashboard → tu proyecto → SQL Editor → New query → Run
--
-- Es idempotente: se puede correr varias veces sin romper nada.
-- Las políticas RLS son permisivas (acceso público vía anon key);
-- migraremos a auth real con Supabase Auth en una fase posterior.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Tablas ─────────────────────────────────────────────────────────────────

-- Cada cliente: id = slug ("acme-corp"), data = todo el objeto del CRM en JSONB
create table if not exists public.clientes (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Credenciales de login: { email/username, password }
create table if not exists public.user_creds (
  cliente_id  text primary key references public.clientes(id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- API keys: { meta, google, ... } — JSONB para crecer flexible
create table if not exists public.api_keys (
  cliente_id  text primary key references public.clientes(id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Notas entre admin y cliente (threading vía reply_to_id)
create table if not exists public.notas (
  id            text primary key,
  cliente_id    text not null references public.clientes(id) on delete cascade,
  autor         text not null,                   -- 'admin' | 'cliente'
  texto         text not null,
  reply_to_id   text,
  fecha         timestamptz not null default now()
);

create index if not exists notas_cliente_idx on public.notas(cliente_id);
create index if not exists notas_fecha_idx   on public.notas(fecha);

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Permisiva: cualquier request con el anon key tiene acceso total.
-- Apropiado mientras la app sigue siendo herramienta interna con login propio.
-- En la fase de Supabase Auth restringiremos por user_id.

alter table public.clientes   enable row level security;
alter table public.user_creds enable row level security;
alter table public.api_keys   enable row level security;
alter table public.notas      enable row level security;

drop policy if exists "All access clientes"   on public.clientes;
drop policy if exists "All access user_creds" on public.user_creds;
drop policy if exists "All access api_keys"   on public.api_keys;
drop policy if exists "All access notas"      on public.notas;

create policy "All access clientes"   on public.clientes   for all using (true) with check (true);
create policy "All access user_creds" on public.user_creds for all using (true) with check (true);
create policy "All access api_keys"   on public.api_keys   for all using (true) with check (true);
create policy "All access notas"      on public.notas      for all using (true) with check (true);

-- ─── Trigger para mantener updated_at fresco ────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_clientes   on public.clientes;
drop trigger if exists touch_user_creds on public.user_creds;
drop trigger if exists touch_api_keys   on public.api_keys;

create trigger touch_clientes   before update on public.clientes   for each row execute function public.touch_updated_at();
create trigger touch_user_creds before update on public.user_creds for each row execute function public.touch_updated_at();
create trigger touch_api_keys   before update on public.api_keys   for each row execute function public.touch_updated_at();
