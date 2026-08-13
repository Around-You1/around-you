-- 000030_create_events.sql
-- The event-tracking foundation. One append-only table for behavioural events
-- (QR scans today; logins, searches, listing views next). Almost every
-- behavioural analytic (usage, partner ROI, geographic demand) becomes a query
-- over this table. Kept deliberately generic so new event types need no schema
-- change.

create table if not exists events (
  id          bigint generated always as identity primary key,
  event_type  text   not null,                 -- 'qr_scan' | 'login' | 'search' | 'listing_view' | ...
  actor_type  text,                            -- 'guest' | 'local' | 'partner' | 'anon'
  code        text,                            -- access/partner code involved (e.g. the scanned QR code)
  entity_type text,                            -- 'restaurant' | 'service' | 'attraction' | 'accommodation'
  entity_id   bigint,
  area        text,
  province    text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_events_type_created on events (event_type, created_at);
create index if not exists idx_events_code         on events (code);
create index if not exists idx_events_entity       on events (entity_type, entity_id);

-- New table → enable + force RLS and revoke PostgREST roles (guarded for CI).
alter table events enable row level security;
alter table events force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on events from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on events from authenticated;
  end if;
end $$;
