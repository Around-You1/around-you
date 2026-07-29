-- ============================================================================
-- 000004_add_postal_code_to_users
-- ============================================================================
-- Local Guest sign-in now collects email + province + postal code (not
-- area) — see app/auth/auth.go's LocalGuestLoginRequest. This column stores
-- it. Nullable with a '' default, same reasoning as every other optional
-- text column on this table (000003_null_safety_defaults.sql): NULL and ''
-- are both valid "not set" states here, but a DEFAULT means a future INSERT
-- that forgets this column can't reintroduce a NULL-scan crash.
-- ============================================================================

alter table users
  add column if not exists postal_code text default '';

update users set postal_code = coalesce(postal_code, '');
