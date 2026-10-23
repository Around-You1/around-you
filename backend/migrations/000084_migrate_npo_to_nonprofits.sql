-- Move existing NPO/PBO partners (services flagged is_nonprofit) into the new,
-- independent `nonprofits` table, preserving their id so loyalty cards, ratings
-- and redemptions keep matching. Idempotent and non-destructive: rows are only
-- deleted from `services` once they are confirmed present in `nonprofits`.

-- 1. Copy NPO rows into nonprofits. service_id is a GENERATED column, so it is
--    excluded (recomputed); every other column (including id) is copied as-is.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'services'
     and is_generated  = 'NEVER';
  execute format(
    'insert into nonprofits (%1$s) select %1$s from services s '
    || 'where coalesce(s.is_nonprofit, false) = true '
    || 'and not exists (select 1 from nonprofits n where n.id = s.id)',
    cols);
end $$;

-- 2. Keep the nonprofits id sequence ahead of the migrated ids.
select setval(pg_get_serial_sequence('nonprofits', 'id'),
              (select greatest(coalesce(max(id), 1), 1) from nonprofits));

-- 3. Re-point loyalty cards/programs, ratings and discount redemptions from the
--    old "service" partner type to "nonprofit" for the migrated ids.
update loyalty_programs set partner_type = 'nonprofit'
 where partner_type = 'service'
   and partner_id in (select id from services where coalesce(is_nonprofit, false) = true);

update loyalty_cards set partner_type = 'nonprofit'
 where partner_type = 'service'
   and partner_id in (select id from services where coalesce(is_nonprofit, false) = true);

update ratings set entity_type = 'nonprofit'
 where entity_type = 'service'
   and entity_id in (select id from services where coalesce(is_nonprofit, false) = true);

update discount_redemptions set entity_type = 'nonprofit'
 where entity_type = 'service'
   and entity_id in (select id from services where coalesce(is_nonprofit, false) = true);

-- 4. Remove the migrated rows from services (only those confirmed copied).
delete from services s
 where coalesce(s.is_nonprofit, false) = true
   and exists (select 1 from nonprofits n where n.id = s.id);
