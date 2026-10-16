-- Adds a separate "Accounting Address" (office / holding-company address) to the
-- three work-from-client partner types. The existing `address` column remains
-- the public establishment address shown on Guest/Local pages (hidden when the
-- partner works from different addresses); accounting_address is Official-Use
-- only and is stripped from guest/partner API responses.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS accounting_address text;
ALTER TABLE services    ADD COLUMN IF NOT EXISTS accounting_address text;
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS accounting_address text;
