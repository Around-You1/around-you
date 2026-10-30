-- Add a free-text delivery price/fee to restaurants, shown when the restaurant
-- offers Delivery (e.g. "R35", "Free over R150", "R10/km"). Empty string = none set.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_price text NOT NULL DEFAULT '';
