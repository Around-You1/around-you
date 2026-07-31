-- ============================================================================
-- 000012_add_image_urls_arrays
-- ============================================================================
-- Adds image_urls (plural, array) to restaurants/services/attractions,
-- matching what accommodations already has. image_url (singular) stays as
-- the primary/first photo; image_urls holds the full set once the frontend
-- is updated to actually collect more than one photo — that UI work hasn't
-- been done yet, this just gives it somewhere to go.
-- ============================================================================

alter table restaurants
  add column if not exists image_urls text[] not null default '{}';

alter table services
  add column if not exists image_urls text[] not null default '{}';

alter table attractions
  add column if not exists image_urls text[] not null default '{}';
