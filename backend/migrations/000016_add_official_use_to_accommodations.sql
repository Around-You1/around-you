-- ============================================================================
-- 000016_add_official_use_to_accommodations
-- ============================================================================
-- Brings accommodations in line with restaurants/services/attractions.
--
-- OfficialUseSection.tsx renders all ten Official Use fields on every entity
-- form, but the accommodations table only ever had five columns for them.
-- The other five — Rep Name, Company Registration Number, Company VAT
-- Number, Guest Type and Access Level — were displayed, editable, and then
-- silently discarded on save: no column to write to, and the API layer
-- dropped them too.
--
-- 000013 added official_rep_name / company_reg_number / company_vat_number to
-- the other three tables but skipped accommodations. guest_type and
-- access_level likewise exist elsewhere but not here. This closes both gaps
-- in one step.
--
-- All five default to '' so existing rows read back as empty strings rather
-- than NULL, matching how the store's COALESCE(...) SELECT already treats
-- every other optional text column.
-- ============================================================================

alter table accommodations
  add column if not exists official_rep_name text default '',
  add column if not exists company_reg_number text default '',
  add column if not exists company_vat_number text default '',
  add column if not exists guest_type text default '',
  add column if not exists access_level text default '';
