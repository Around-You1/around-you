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
-- Applied automatically by the Go migrate runner (backend/migrations) on deploy.

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
    execute format('alter table public.%I force  row level security;', r.tablename);
    execute format('revoke all on public.%I from anon, authenticated;', r.tablename);
  end loop;
end $$;

-- Ensure future tables also default to no anon/authenticated access.
alter default privileges in schema public revoke all on tables from anon, authenticated;
