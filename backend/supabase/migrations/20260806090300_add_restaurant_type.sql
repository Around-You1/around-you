-- Mirror of backend/migrations/000023_add_restaurant_type.sql.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS restaurant_type text[] NOT NULL DEFAULT '{}';
