-- Mirror of backend/migrations/000017_add_restaurant_booking_items.sql
-- Adds the bookable-items list to restaurants for Booking partners.
-- Stored as a single jsonb array of { name, price, duration } objects.
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS booking_items jsonb NOT NULL DEFAULT '[]'::jsonb;
