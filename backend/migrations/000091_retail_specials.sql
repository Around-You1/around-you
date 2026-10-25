-- Retail "Discount / Specials" list: a jsonb array of entries, each
-- { type: 'discount'|'stampcard', audience: 'guest'|'local'|'both',
--   enabled: bool, line1: text, line2: text }.
-- Only used by retail partners; shown on the Guest/Local pages under the
-- "Discount / My Stamp Card" dropdown.
alter table retail add column if not exists specials jsonb not null default '[]'::jsonb;
