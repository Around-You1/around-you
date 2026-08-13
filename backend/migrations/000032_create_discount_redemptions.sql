-- 000032_create_discount_redemptions.sql
-- Verified discount redemptions. A guest generates a one-time token (shown as a
-- QR in their app); the restaurant scans it (logged into the Partner Dashboard)
-- which marks it redeemed. A redeemed row is the proof-of-visit that unlocks the
-- guest's rating for that partner (see app/rating). voter_key matches
-- ratings.voter_key so the same identity that redeems is the one allowed to rate.

create table if not exists discount_redemptions (
  id          bigint generated always as identity primary key,
  token       text   not null unique,
  entity_type text   not null,                 -- restaurant | service | attraction
  entity_id   bigint not null,
  voter_key   text   not null,                 -- the guest's user id (matches ratings.voter_key)
  voter_type  text   not null,                 -- local_guest | holiday_guest
  status      text   not null default 'pending' check (status in ('pending','redeemed','expired')),
  created_at  timestamptz not null default now(),
  redeemed_at timestamptz
);
create index if not exists idx_redemptions_lookup on discount_redemptions (entity_type, entity_id, voter_key, status);
create index if not exists idx_redemptions_token  on discount_redemptions (token);

-- New table → enable + force RLS and revoke PostgREST roles (guarded for CI).
alter table discount_redemptions enable row level security;
alter table discount_redemptions force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on discount_redemptions from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on discount_redemptions from authenticated;
  end if;
end $$;
