-- ============================================================================
-- 000013_add_official_use_fields
-- ============================================================================
-- Fixes a real bug: every rep submission was saving the REP's own name into
-- official_contact_name — the field meant for the CLIENT's own contact
-- person ("Person Responsible" in the onboarding app). That happened
-- because there was no separate place for the rep's name to go. This adds
-- one, plus the two Company Registration/VAT fields the onboarding app
-- already collects but had nowhere to save.
-- ============================================================================

alter table restaurants
  add column if not exists official_rep_name text default '',
  add column if not exists company_reg_number text default '',
  add column if not exists company_vat_number text default '';

alter table services
  add column if not exists official_rep_name text default '',
  add column if not exists company_reg_number text default '',
  add column if not exists company_vat_number text default '';

alter table attractions
  add column if not exists official_rep_name text default '',
  add column if not exists company_reg_number text default '',
  add column if not exists company_vat_number text default '';
