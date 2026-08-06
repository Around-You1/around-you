-- Mirror of backend/migrations/000021_add_restaurant_menu_pdfs.sql.
-- Menu PDF uploads for restaurants with no online menu.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS menu_pdf_urls text[] NOT NULL DEFAULT '{}';
