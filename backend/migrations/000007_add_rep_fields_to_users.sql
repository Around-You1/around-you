-- ============================================================================
-- 000007_add_rep_fields_to_users
-- ============================================================================
-- Adds support for the "Rep" role — sales/onboarding reps who sign in with
-- their full name + a rep code (e.g. "Rep00000001"), not a password. Reps
-- are created by a SuperAdmin (see CreateRep in app/auth/auth.go), never
-- self-registered.
-- ============================================================================

alter table users
  add column if not exists full_name text default '',
  add column if not exists rep_code text;

create index if not exists idx_users_rep_code on users (rep_code);
