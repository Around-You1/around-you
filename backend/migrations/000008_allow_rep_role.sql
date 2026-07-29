-- ============================================================================
-- 000008_allow_rep_role
-- ============================================================================
-- The original users table (20260721095109_init_schema.sql) restricted role
-- to a fixed enum: 'Guest', 'LocalGuest', 'Partner', 'SuperAdmin' — written
-- before the Rep role existed. CreateRep (app/auth/auth.go) now needs to
-- insert role='Rep', which the old constraint rejects outright.
--
-- Postgres doesn't support "add a value to an existing CHECK constraint" —
-- the constraint has to be dropped and recreated with the full new list.
-- Named explicitly here so a future addition doesn't have to guess the
-- auto-generated name the way this fix had to.
-- ============================================================================

alter table users drop constraint if exists users_role_check;

alter table users add constraint users_role_check
  check (role in ('Guest', 'LocalGuest', 'Partner', 'SuperAdmin', 'Rep'));
