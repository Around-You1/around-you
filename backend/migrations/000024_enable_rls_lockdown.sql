-- 000024_enable_rls_lockdown.sql
-- Close the Supabase REST back door: with RLS off, the public anon key could
-- read every public table directly via /rest/v1/<table>, bypassing the Go API
-- (confirmed leaking wifi_password / company_vat_number on 2026-08-11).
--
-- Enables + forces RLS on every public table and revokes the PostgREST roles'
-- privileges, so direct REST access returns permission denied. The Go backend
-- connects as `postgres` (rolbypassrls = true), so its reads/writes are
-- unaffected. Idempotent: safe to re-run / re-apply.
--
-- Portable: the anon/authenticated roles exist on Supabase but NOT on a vanilla
-- Postgres (e.g. the CI test database), so each revoke is guarded by a role
-- existence check. Applied automatically by the Go migrate runner on deploy.

-- 1) Enable + force RLS on every public table (works on any Postgres).
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
    execute format('alter table public.%I force  row level security;', r.tablename);
  end loop;
end $$;

-- 2) Revoke the Supabase PostgREST roles' access — only for roles that exist.
do $$
declare
  role_name text;
  t         record;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      for t in select tablename from pg_tables where schemaname = 'public'
      loop
        execute format('revoke all on public.%I from %I;', t.tablename, role_name);
      end loop;
      execute format('alter default privileges in schema public revoke all on tables from %I;', role_name);
    end if;
  end loop;
end $$;
