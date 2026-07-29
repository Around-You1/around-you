-- ============================================================================
-- 000009_add_contact_description_to_accommodations
-- ============================================================================
-- Adds the "Contact" and "Description" fields the rep onboarding app already
-- collects for accommodations but previously had nowhere to go — see
-- RepOnboardingApp.tsx's isAccommodation section.
-- ============================================================================

alter table accommodations
  add column if not exists contact text default '',
  add column if not exists description text default '';

update accommodations set
  contact = coalesce(contact, ''),
  description = coalesce(description, '');
