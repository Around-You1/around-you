-- Menu PDF uploads for restaurants that have no online menu. Stored as an array
-- of uploaded PDF URLs (one entry per page is fine). Defaults to empty; new and
-- existing rows need no backfill. IF NOT EXISTS keeps re-runs safe.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS menu_pdf_urls text[] NOT NULL DEFAULT '{}';
