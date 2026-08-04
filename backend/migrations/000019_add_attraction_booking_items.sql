-- Adds the bookable-items list to attractions for Booking partners.
-- Stored as a single jsonb array of { name, price, duration } objects.
-- Idempotent so it is safe to run more than once.
ALTER TABLE attractions
  ADD COLUMN IF NOT EXISTS booking_items jsonb NOT NULL DEFAULT '[]'::jsonb;
