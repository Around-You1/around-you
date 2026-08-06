-- Partner "edit code": a secret separate from partner_code that lets a partner
-- unlock editing of their OWN profile from the Partner Dashboard.
--
-- The volatile per-row DEFAULT means: new rows get a random code automatically
-- (no change needed to the INSERT statements), and each existing row gets its
-- own distinct code when the column is added (a volatile default forces a table
-- rewrite that evaluates the expression per row). IF NOT EXISTS keeps it
-- idempotent so re-running is safe.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS edit_code text NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 10));
ALTER TABLE services    ADD COLUMN IF NOT EXISTS edit_code text NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 10));
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS edit_code text NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 10));
