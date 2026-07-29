-- ============================================================================
-- 000005_add_password_hash_to_users
-- ============================================================================
-- Adds password-based login, for SuperAdmin accounts only — every other
-- role (Guest, LocalGuest, Partner) signs in via access code or one-time
-- email code, never a password.
--
-- password_hash stores a bcrypt hash, never the actual password — bcrypt is
-- one-way (there is no "decrypt" operation), so even direct database access
-- can't recover the original password, only verify a guess against it.
-- ============================================================================

alter table users
  add column if not exists password_hash text;
