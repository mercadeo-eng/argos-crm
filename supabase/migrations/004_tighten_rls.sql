-- ════════════════════════════════════════════════════════════════════════════
-- Argos CRM — Aprieta RLS y limpia user_creds (correr SOLO DESPUÉS de
-- mergear feat/supabase-auth a main y verificar que producción funciona)
-- ════════════════════════════════════════════════════════════════════════════
-- Si corres esto antes del merge, producción rompe — el código viejo aún
-- depende de las políticas permisivas y de la tabla user_creds.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Quita las políticas permisivas creadas en 001
drop policy if exists "All access clientes"   on public.clientes;
drop policy if exists "All access user_creds" on public.user_creds;
drop policy if exists "All access api_keys"   on public.api_keys;
drop policy if exists "All access notas"      on public.notas;

-- 2. clientes: admin all, cliente read-only su propio cliente
create policy "Admin all clientes" on public.clientes
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Cliente read own" on public.clientes
  for select using (id = public.current_cliente_id());

-- 3. api_keys: solo admin (el cliente no necesita ver ni saber que existen)
create policy "Admin all api_keys" on public.api_keys
  for all using (public.is_admin()) with check (public.is_admin());

-- 4. notas: admin all, cliente lee las suyas y solo puede insertar como autor 'cliente'
create policy "Admin all notas" on public.notas
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Cliente read own notas" on public.notas
  for select using (cliente_id = public.current_cliente_id());

create policy "Cliente insert own notas" on public.notas
  for insert with check (
    cliente_id = public.current_cliente_id() and autor = 'cliente'
  );

-- 5. Limpieza: user_creds ya no se usa (auth.users lo reemplaza)
drop table if exists public.user_creds cascade;
