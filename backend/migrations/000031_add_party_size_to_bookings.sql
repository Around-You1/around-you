-- 000031_add_party_size_to_bookings.sql
-- Restaurant table bookings: instead of priced items + 10%, a restaurant
-- booking is a table for N people and Around You charges the restaurant R10 per
-- head (stored as the booking's commission, so it flows into the restaurant's
-- monthly invoice and the rep's commission exactly like the 10% does). party_size
-- holds the headcount; it is null/0 for the item-based service/attraction flow.

alter table bookings add column if not exists party_size int;
