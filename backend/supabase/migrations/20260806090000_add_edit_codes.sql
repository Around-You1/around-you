-- Mirror of backend/migrations/000020_add_edit_codes.sql (Supabase tooling copy).
-- Partner "edit code": a secret separate from partner_code that lets a partner
-- unlock editing of their OWN profile from the Partner Dashboard.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS edit_code text NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 10));
ALTER TABLE services    ADD COLUMN IF NOT EXISTS edit_code text NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 10));
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS edit_code text NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 10));
