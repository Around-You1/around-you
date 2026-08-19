-- 000037_create_moderation_flags.sql
-- Content-moderation flags raised when a partner profile or rep-onboarding
-- submission contains profanity, abuse, or discriminatory language. Content is
-- NOT blocked on save; each hit is recorded here and surfaced as an alert on
-- the Admin Dashboard for a SuperAdmin to review (status open -> reviewed /
-- dismissed).

create table if not exists moderation_flags (
  id           bigserial primary key,
  source       text not null,               -- 'partner_profile' | 'rep_onboarding'
  entity_type  text not null default '',    -- 'restaurant' | 'service' | 'attraction' | 'accommodation' | 'rep'
  entity_id    bigint,                       -- null for reps / entity-less submissions
  subject      text not null default '',     -- display label (business or rep name)
  field        text not null default '',     -- which field the hit came from (name/description/...)
  category     text not null default '',     -- 'profanity' | 'discrimination' | 'abuse'
  matched_term text not null default '',
  snippet      text not null default '',     -- short preview of the offending text
  actor        text not null default '',     -- who submitted it (email + role), if known
  status       text not null default 'open', -- 'open' | 'reviewed' | 'dismissed'
  reviewed_by  text not null default '',
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_moderation_flags_status  on moderation_flags (status, created_at desc);
create index if not exists idx_moderation_flags_entity  on moderation_flags (source, entity_type, entity_id);

-- New table -> enable + force RLS and revoke PostgREST roles (guarded for CI,
-- whose plain postgres image has no anon/authenticated roles).
alter table moderation_flags enable row level security;
alter table moderation_flags force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on moderation_flags from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on moderation_flags from authenticated;
  end if;
end $$;
