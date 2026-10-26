-- A Retail (or NPO/PBO) partner signing in with an Access Code creates a users
-- row with entity_type = 'retail' / 'nonprofit' (and profile_type likewise).
-- The users_entity_type_check constraint predates these types (it was added
-- directly on the database, not via a migration) and rejected them, so partner
-- sign-in failed with "new row for relation users violates check constraint
-- users_entity_type_check".
--
-- Recreate entity_type's check with the full set of types the app uses,
-- allowing NULL and the empty-string default (Guest / Local / SuperAdmin rows
-- carry ''). NOT VALID skips re-checking historical rows (so an unexpected
-- legacy value can never abort startup) while still enforcing on every new
-- insert and update.
alter table users drop constraint if exists users_entity_type_check;
alter table users add constraint users_entity_type_check
  check (
    entity_type is null
    or entity_type = any (array[
      '', 'accommodation', 'restaurant', 'service', 'attraction',
      'retail', 'nonprofit', 'estate_agency', 'estate_agent'
    ])
  ) not valid;

-- Do the same for profile_type, but ONLY if a check constraint already exists
-- there (so we never introduce a new restriction that wasn't present before).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'users_profile_type_check'
      and conrelid = 'users'::regclass
  ) then
    alter table users drop constraint users_profile_type_check;
    alter table users add constraint users_profile_type_check
      check (
        profile_type is null
        or profile_type = any (array[
          '', 'accommodation', 'restaurant', 'service', 'attraction',
          'retail', 'nonprofit', 'estate_agency', 'estate_agent'
        ])
      ) not valid;
  end if;
end $$;
