-- 000039_add_accommodation_codes.sql
-- Bring accommodations in line with restaurants/services/attractions for the
-- profile code lifecycle:
--   * edit_code — a partner "edit code" (accommodations previously had none).
--   * profile_reference_code_active — an active flag on the existing Profile
--     Access Code (profile_reference_code), so it can be disabled when a profile
--     is deactivated/deleted and re-issued on reinstatement, mirroring
--     partner_code_active on the other three categories.
--
-- Volatile per-row DEFAULT gives each existing row its own distinct edit_code
-- (a table rewrite evaluates the expression per row). IF NOT EXISTS keeps it
-- idempotent.
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS edit_code text NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 10));
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS profile_reference_code_active boolean NOT NULL DEFAULT true;
