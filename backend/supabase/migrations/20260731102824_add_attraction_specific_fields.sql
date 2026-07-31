-- ============================================================================
-- 000014_add_attraction_specific_fields
-- ============================================================================
-- Adds Trail Difficulty, Wildlife Cautions, Tide Warnings, Parking Notes,
-- and Photography Spots — attraction-only fields, not shared with
-- restaurants or services.
-- ============================================================================

alter table attractions
  add column if not exists trail_difficulty text default '',
  add column if not exists wildlife_cautions text default '',
  add column if not exists tide_warnings text default '',
  add column if not exists parking_notes text default '',
  add column if not exists photography_spots text default '';
