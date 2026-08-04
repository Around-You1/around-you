-- Mirror of backend/migrations/000018_add_service_booking_items.sql
-- Adds the bookable-items list to services for Booking partners.
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS booking_items jsonb NOT NULL DEFAULT '[]'::jsonb;
