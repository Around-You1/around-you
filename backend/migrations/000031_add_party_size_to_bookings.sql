-- 000031_add_party_size_to_bookings.sql
-- Restaurant table bookings: instead of priced items + 10%, a restaurant
-- booking is a table for N people and Around You charges the restaurant R10 per
-- head (stored as the booking's commission, so it flows into the restaurant's
-- monthly invoice and the rep's commission exactly like the 10% does). party_size
-- holds the headcount; it is null/0 for the item-based service/attraction flow.
--
-- NOTE: the `bookings` table was created directly in Supabase, not by this
-- migrations folder, so it is absent from a fresh CI database. Guard the ALTER
-- so this migration applies in production (where bookings exists) and is a
-- harmless no-op where it doesn't.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'bookings'
  ) then
    alter table bookings add column if not exists party_size int;
  end if;
end $$;
