-- One-off: move "Pandora's Box" from Retail back into Business/Services. It was
-- registered before the Retail category existed, so it belongs in `services`.
-- Preserves its id so loyalty, ratings, redemptions, billing and suggestions keep
-- matching. Idempotent and non-destructive: it only deletes the retail row once it
-- is confirmed copied, and it SKIPS entirely if no matching retail row is found or
-- if that id already exists in services (which would clash on insert — that case
-- needs a manual/id-remapped move instead).
do $$
declare
  rid  bigint;
  cols text;
begin
  -- Find the Pandora retail row (if any).
  select id into rid from retail
   where lower(trim(name)) like '%pandora%'
   order by id limit 1;
  if rid is null then
    raise notice 'move_pandora: no matching retail row; nothing to do';
    return;
  end if;

  -- Abort safely if that id is already used in services (would clash on insert).
  if exists (select 1 from services where id = rid) then
    raise notice 'move_pandora: services.id % already exists; skipping (needs manual move)', rid;
    return;
  end if;

  -- Copy using only columns present in BOTH tables (excludes retail-only columns
  -- such as `specials`, and generated columns such as service_id).
  select string_agg(quote_ident(c.column_name), ', ')
    into cols
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = 'services' and c.is_generated = 'NEVER'
     and exists (
       select 1 from information_schema.columns r
        where r.table_schema = 'public' and r.table_name = 'retail'
          and r.column_name = c.column_name and r.is_generated = 'NEVER');
  execute format('insert into services (%1$s) select %1$s from retail where id = %2$s', cols, rid);

  -- Keep the services id sequence ahead of the inserted id.
  perform setval(pg_get_serial_sequence('services', 'id'),
                 (select greatest(coalesce(max(id), 1), 1) from services));

  -- Re-point every related record from retail -> service for this id, so nothing
  -- is orphaned (billing, ratings, discounts, bookings, loyalty, charity, etc.).
  update partner_subscription  set partner_type = 'service'        where partner_type = 'retail'        and partner_id = rid;
  update invoice               set partner_type = 'service'        where partner_type = 'retail'        and partner_id = rid;
  update commission            set source_partner_type = 'service' where source_partner_type = 'retail' and source_partner_id = rid;
  update ratings               set entity_type = 'service'         where entity_type = 'retail'         and entity_id = rid;
  update discount_redemptions  set entity_type = 'service'         where entity_type = 'retail'         and entity_id = rid;
  update bookings              set entity_type = 'service'         where entity_type = 'retail'         and entity_id = rid;
  update events                set entity_type = 'service'         where entity_type = 'retail'         and entity_id = rid;
  update partner_charity       set partner_type = 'service'        where partner_type = 'retail'        and partner_id = rid;
  update charity_nominations   set partner_type = 'service'        where partner_type = 'retail'        and partner_id = rid;
  update loyalty_programs      set partner_type = 'service'        where partner_type = 'retail'        and partner_id = rid;
  update loyalty_cards         set partner_type = 'service'        where partner_type = 'retail'        and partner_id = rid;
  update loyalty_redemptions   set partner_type = 'service'        where partner_type = 'retail'        and partner_id = rid;
  update profile_suggestions   set owner_type = 'service'          where owner_type = 'retail'          and owner_id = rid;
  update profile_suggestions   set target_type = 'service'         where target_type = 'retail'         and target_id = rid;

  -- Finally remove the retail row (confirmed copied above).
  delete from retail where id = rid;

  raise notice 'move_pandora: moved retail id % to services', rid;
end $$;
