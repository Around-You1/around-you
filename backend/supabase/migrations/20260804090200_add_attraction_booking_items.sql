-- Mirror of backend/migrations/000019_add_attraction_booking_items.sql
-- Adds the bookable-items list to attractions for Booking partners.
ALTER TABLE attractions
  ADD COLUMN IF NOT EXISTS booking_items jsonb NOT NULL DEFAULT '[]'::jsonb;