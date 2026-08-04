-- Adds the bookable-items list to services for Booking partners.
-- Stored as a single jsonb array of { name, price, duration } objects.
-- Idempotent so it is safe to run more than once.
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS booking_items jsonb NOT NULL DEFAULT '[]'::jsonb;
