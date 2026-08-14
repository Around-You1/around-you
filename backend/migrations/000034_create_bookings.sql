-- 000034_create_bookings.sql
-- The bookings table was originally created directly in Supabase, so it was
-- absent from this migrations folder (a fresh/CI database had no bookings table,
-- which is why the guarded party_size ALTER in 000031 was needed). This makes
-- the folder the complete source of truth:
--   * Production already has the table, so CREATE ... IF NOT EXISTS is a no-op there.
--   * A fresh database (CI, or a from-scratch rebuild) now gets a complete
--     bookings table — including party_size, since 000031's guarded ALTER is
--     skipped when the table doesn't yet exist.

create table if not exists bookings (
  id             bigint generated always as identity primary key,
  entity_type    text not null,
  entity_id      bigint not null,
  entity_name    text not null default '',
  customer_name  text not null default '',
  customer_email text not null default '',
  customer_phone text not null default '',
  booking_date   text not null default '',
  booking_time   text not null default '',
  items          jsonb not null default '[]'::jsonb,
  total          double precision not null default 0,
  commission     double precision not null default 0,
  status         text not null default 'pending',
  party_size     int,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_bookings_customer_email on bookings (lower(customer_email));
create index if not exists idx_bookings_entity         on bookings (entity_type, entity_id);

-- RLS (idempotent — production already has it from 000024; a fresh DB gets it here).
alter table bookings enable row level security;
alter table bookings force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on bookings from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on bookings from authenticated;
  end if;
end $$;
