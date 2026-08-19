-- 000038_create_archived_partners.sql
-- A recycle bin for deleted partner profiles. When an admin deletes a profile it
-- is MOVED here (full JSON snapshot) and removed from its live table, so it no
-- longer appears in any listing or the public API — but can be reinstated later
-- without re-onboarding. Reinstatement re-creates the profile with brand-new
-- Access/Edit codes (the archived codes are never reused). Kept indefinitely;
-- an admin can permanently purge a row from the archive view.

create table if not exists archived_partners (
  id            bigserial primary key,
  entity_type   text   not null,               -- restaurant | service | attraction | accommodation
  original_id   bigint,                         -- id it had while live (informational)
  name          text   not null default '',
  province      text   not null default '',
  area          text   not null default '',
  payload       jsonb  not null,                -- full row snapshot for reinstatement
  archived_by   text   not null default '',     -- admin who deleted it (email + role)
  reason        text   not null default '',
  archived_at   timestamptz not null default now()
);

create index if not exists idx_archived_partners_type on archived_partners (entity_type, archived_at desc);

-- New table -> enable + force RLS and revoke PostgREST roles (guarded for CI).
alter table archived_partners enable row level security;
alter table archived_partners force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on archived_partners from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on archived_partners from authenticated;
  end if;
end $$;
