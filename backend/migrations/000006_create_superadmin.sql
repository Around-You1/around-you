-- ============================================================================
-- 000006_create_superadmin
-- ============================================================================
-- Creates the first (and, for now, only) SuperAdmin account. The password
-- hash below was generated locally via cmd/hashpassword — the actual
-- password was never sent anywhere, including here; a bcrypt hash cannot be
-- reversed back into the original password, only checked against a login
-- attempt (see app/auth/auth.go's Login handler).
--
-- Written so it's safe to run more than once (e.g. if the migration runner
-- ever retries) — it only inserts if no SuperAdmin with this email already
-- exists, rather than assuming a unique constraint that this table doesn't
-- actually have (see 000002_create_users_sessions.sql's note on why email
-- isn't unique here).
-- ============================================================================

insert into users (email, role, password_hash)
select 'app.aroundyou@gmail.com', 'SuperAdmin', '$2a$10$c1B5Uetok1pyfvUGRVbB2u4NbdrqOTWllmL.osgaZDIgtmeCGpw42'
where not exists (
  select 1 from users
  where lower(email) = lower('app.aroundyou@gmail.com') and role = 'SuperAdmin'
);
