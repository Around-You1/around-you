-- One-off: move "St Helena Bay SPAR and TOPS" from Business/Services into Retail,
-- preserving its id so loyalty, ratings, redemptions and billing keep matching.
-- Idempotent and non-destructive (only deletes the service once copied to retail).

-- 1. Copy the matching business service into retail (service_id is generated; excluded).
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
    from information_schema.columns
   where table_schema='public' and table_name='services' and is_generated='NEVER';
  execute format(
    'insert into retail (%1$s) select %1$s from services s '
    || 'where coalesce(s.is_nonprofit,false)=false '
    || 'and lower(trim(s.name)) like ''%%spar%%'' and lower(trim(s.name)) like ''%%tops%%'' '
    || 'and not exists (select 1 from retail r where r.id = s.id)', cols);
end $$;

select setval(pg_get_serial_sequence('retail','id'), (select greatest(coalesce(max(id),1),1) from retail));

-- 2. Re-point related records from service -> retail for the matched id(s).
update loyalty_programs    set partner_type='retail' where partner_type='service' and partner_id in (select id from services where lower(trim(name)) like '%spar%' and lower(trim(name)) like '%tops%');
update loyalty_cards       set partner_type='retail' where partner_type='service' and partner_id in (select id from services where lower(trim(name)) like '%spar%' and lower(trim(name)) like '%tops%');
update ratings             set entity_type='retail'  where entity_type='service'  and entity_id  in (select id from services where lower(trim(name)) like '%spar%' and lower(trim(name)) like '%tops%');
update discount_redemptions set entity_type='retail' where entity_type='service'  and entity_id  in (select id from services where lower(trim(name)) like '%spar%' and lower(trim(name)) like '%tops%');
update partner_subscription set partner_type='retail' where partner_type='service' and partner_id in (select id from services where lower(trim(name)) like '%spar%' and lower(trim(name)) like '%tops%');
update partner_charity     set partner_type='retail' where partner_type='service' and partner_id in (select id from services where lower(trim(name)) like '%spar%' and lower(trim(name)) like '%tops%');
update charity_nominations set partner_type='retail' where partner_type='service' and partner_id in (select id from services where lower(trim(name)) like '%spar%' and lower(trim(name)) like '%tops%');

-- 3. Remove the moved service (only if confirmed copied to retail).
delete from services s
 where coalesce(s.is_nonprofit,false)=false
   and lower(trim(s.name)) like '%spar%' and lower(trim(s.name)) like '%tops%'
   and exists (select 1 from retail r where r.id = s.id);
