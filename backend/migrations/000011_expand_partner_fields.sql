-- ============================================================================
-- 000011_expand_partner_fields
-- ============================================================================
-- Adds, to restaurants/services/attractions together (since all three need
-- the same additions):
--   - Four more Payment Options: Gaap, Snap Scan, Yoco, Zapper (the existing
--     payment_mobile column is being relabeled "Mobile Tap" in the UI, not
--     renamed here — no data migration needed for that one)
--   - Real per-entity Socials (Website/Facebook/Instagram/Tiktok/X) — fixes
--     the confirmed bug where RestaurantForm.tsx's Socials section collected
--     input with nowhere on the backend to actually save it
--   - Restaurant only: real per-entity Bookings (email + contact number),
--     same reasoning as Socials above
--   - Service/Attraction only: Safety Info, Age Restrictions, Fitness Level,
--     Best Time of Day, What to Bring
-- ============================================================================

alter table restaurants
  add column if not exists payment_gaap boolean not null default false,
  add column if not exists payment_snapscan boolean not null default false,
  add column if not exists payment_yoco boolean not null default false,
  add column if not exists payment_zapper boolean not null default false,
  add column if not exists bookings_email text default '',
  add column if not exists bookings_contact_number text default '',
  add column if not exists socials_website text default '',
  add column if not exists socials_facebook text default '',
  add column if not exists socials_instagram text default '',
  add column if not exists socials_tiktok text default '',
  add column if not exists socials_twitter text default '';

alter table services
  add column if not exists payment_gaap boolean not null default false,
  add column if not exists payment_snapscan boolean not null default false,
  add column if not exists payment_yoco boolean not null default false,
  add column if not exists payment_zapper boolean not null default false,
  add column if not exists safety_info text default '',
  add column if not exists age_restrictions text default '',
  add column if not exists fitness_level text default '',
  add column if not exists best_time_of_day text default '',
  add column if not exists what_to_bring text default '',
  add column if not exists socials_website text default '',
  add column if not exists socials_facebook text default '',
  add column if not exists socials_instagram text default '',
  add column if not exists socials_tiktok text default '',
  add column if not exists socials_twitter text default '';

alter table attractions
  add column if not exists payment_gaap boolean not null default false,
  add column if not exists payment_snapscan boolean not null default false,
  add column if not exists payment_yoco boolean not null default false,
  add column if not exists payment_zapper boolean not null default false,
  add column if not exists safety_info text default '',
  add column if not exists age_restrictions text default '',
  add column if not exists fitness_level text default '',
  add column if not exists best_time_of_day text default '',
  add column if not exists what_to_bring text default '',
  add column if not exists socials_website text default '',
  add column if not exists socials_facebook text default '',
  add column if not exists socials_instagram text default '',
  add column if not exists socials_tiktok text default '',
  add column if not exists socials_twitter text default '';
