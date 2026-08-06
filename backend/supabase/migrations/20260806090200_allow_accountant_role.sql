-- Mirror of backend/migrations/000022_allow_accountant_role.sql.
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('Guest', 'LocalGuest', 'Partner', 'SuperAdmin', 'Rep', 'Accountant'));
