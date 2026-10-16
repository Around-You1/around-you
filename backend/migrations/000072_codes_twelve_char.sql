-- 000072_codes_twelve_char.sql
-- Standardise every auto-generated profile code to 12 characters. The edit_code
-- columns previously defaulted to a 10-character value at the DB level (see
-- 000020 / 000039 / 000040); the partner_code and profile_reference_code are set
-- in Go, which now also uses 12 characters. This changes only the DEFAULT for
-- future rows — existing rows keep their current code until it is next
-- regenerated, so no partner is locked out by this migration.
ALTER TABLE restaurants     ALTER COLUMN edit_code SET DEFAULT upper(substr(md5(random()::text), 1, 12));
ALTER TABLE services        ALTER COLUMN edit_code SET DEFAULT upper(substr(md5(random()::text), 1, 12));
ALTER TABLE attractions     ALTER COLUMN edit_code SET DEFAULT upper(substr(md5(random()::text), 1, 12));
ALTER TABLE accommodations  ALTER COLUMN edit_code SET DEFAULT upper(substr(md5(random()::text), 1, 12));
ALTER TABLE estate_agencies ALTER COLUMN edit_code SET DEFAULT upper(substr(md5(random()::text), 1, 12));
ALTER TABLE estate_agents   ALTER COLUMN edit_code SET DEFAULT upper(substr(md5(random()::text), 1, 12));
