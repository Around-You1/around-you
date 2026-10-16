-- 000074_create_profile_suggestions.sql
-- "My Suggestions": each partner / accommodation profile can recommend up to 10
-- other nearby businesses. One row per (owner -> target) recommendation.
create table if not exists profile_suggestions (
  owner_type  text   not null,   -- restaurant|service|attraction|accommodation
  owner_id    bigint not null,
  target_type text   not null,   -- restaurant|service|attraction|accommodation
  target_id   bigint not null,
  position    int    not null default 0,
  created_at  timestamptz not null default now(),
  primary key (owner_type, owner_id, target_type, target_id)
);
create index if not exists idx_profile_suggestions_owner on profile_suggestions (owner_type, owner_id);

-- New table -> enable + force RLS and revoke PostgREST roles (guarded for CI),
-- matching the events table pattern. The Go backend uses the owner connection.
alter table profile_suggestions enable row level security;
alter table profile_suggestions force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on profile_suggestions from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on profile_suggestions from authenticated;
  end if;
end $$;
