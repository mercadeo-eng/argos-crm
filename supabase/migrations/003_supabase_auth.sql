-- ════════════════════════════════════════════════════════════════════════════
-- Argos CRM — Supabase Auth setup (aditivo, no rompe main)
-- ════════════════════════════════════════════════════════════════════════════
-- Pega en Supabase Dashboard → SQL Editor → New query → Run.
-- Es idempotente y NO toca las políticas RLS existentes (esas se aprietan en
-- la migración 004 después de que mergemos a main).
--
-- ANTES de correr esta migración:
--   Dashboard → Authentication → Providers → Email → desactivar "Confirm email"
--   y guardar.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Tabla profiles: 1 fila por cada usuario de auth.users
--    - role 'admin' → cliente_id null (acceso global)
--    - role 'cliente' → cliente_id apunta al cliente correspondiente
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'cliente',
  cliente_id   text references public.clientes(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_cliente_id_idx on public.profiles(cliente_id);

-- Constraints (idempotentes)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add  constraint profiles_role_check
  check (role in ('admin', 'cliente'));

alter table public.profiles drop constraint if exists profiles_cliente_id_check;
alter table public.profiles add  constraint profiles_cliente_id_check
  check (
    (role = 'admin'   and cliente_id is null) or
    (role = 'cliente' and cliente_id is not null)
  );

-- 2. Helpers para usar en RLS (vienen activos para 004 después)
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_cliente_id()
returns text as $$
  select cliente_id from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- 3. Trigger para updated_at
drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 4. RLS sobre profiles (la tabla es nueva, no afecta nada existente)
alter table public.profiles enable row level security;

drop policy if exists "Read own profile"  on public.profiles;
drop policy if exists "Admin all profiles" on public.profiles;

create policy "Read own profile"   on public.profiles
  for select using (id = auth.uid());

create policy "Admin all profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- 5. Promover el admin a role 'admin' en profiles.
--
--    IMPORTANTE: Crear primero el usuario admin desde el Dashboard de Supabase
--    (no via SQL directo a auth.users), porque crear vía SQL no genera el
--    registro en auth.identities y rompe el login con "database error
--    querying schema".
--
--    Pasos en el Dashboard antes de correr esta sección:
--      1. Authentication → Users → "Add user" → "Create new user"
--      2. Email: admin@argos.local / Password: argos
--      3. Marca "Auto Confirm User"
--      4. Create user
--
--    Después de eso, esta SQL le asigna el role 'admin' en profiles.
insert into public.profiles (id, role, cliente_id)
select id, 'admin', null
from auth.users
where email = 'admin@argos.local'
on conflict (id) do update set role = 'admin', cliente_id = null;
