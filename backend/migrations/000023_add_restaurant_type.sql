-- "Restaurant Type" multi-select (Food Truck, Home Meals, Take Away, Pop Up,
-- Restaurant), stored like cuisine_types as a text array. Defaults to empty;
-- IF NOT EXISTS keeps re-runs safe.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS restaurant_type text[] NOT NULL DEFAULT '{}';
