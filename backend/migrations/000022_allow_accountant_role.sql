-- Add 'Accountant' to the users.role CHECK constraint so the accountant
-- sign-in (AccLogin) can issue a session. Postgres can't append a value to an
-- existing CHECK, so the constraint is dropped and recreated with the full
-- list (same approach as 000008_allow_rep_role.sql).
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('Guest', 'LocalGuest', 'Partner', 'SuperAdmin', 'Rep', 'Accountant'));
