-- 000036_create_accountant_access.sql
-- Lets a SuperAdmin set/rotate the accountant sign-in code from the Admin
-- Billing tab instead of editing the ACC_ACCESS_CODE Fly secret by hand.
--
-- Only a bcrypt HASH of the code is stored here, never the code itself — so
-- even someone with database access can't read the accountant's code, and it
-- can't be recovered if lost (only replaced). Single row, id = 1.
--
-- Backward compatible: if no row/hash is set, AccLogin falls back to the
-- ACC_ACCESS_CODE env var, so nothing breaks until an admin sets a code here.

create table if not exists accountant_access (
  id         int primary key default 1 check (id = 1),
  code_hash  text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
insert into accountant_access (id) values (1) on conflict (id) do nothing;

-- New table -> enable + force RLS and revoke PostgREST roles (guarded for CI,
-- whose plain postgres image has no anon/authenticated roles).
alter table accountant_access enable row level security;
alter table accountant_access force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on accountant_access from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on accountant_access from authenticated;
  end if;
end $$;
