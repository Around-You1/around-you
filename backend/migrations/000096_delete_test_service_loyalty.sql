-- Remove the leftover "Test Service" My Stamp Card (a single loyalty card from
-- testing) — its program, every customer card and its redemption log.
delete from loyalty_cards where (partner_type, partner_id) in (
  select 'service', id     from services    where lower(trim(name)) = 'test service'
  union all select 'retail', id      from retail      where lower(trim(name)) = 'test service'
  union all select 'restaurant', id  from restaurants where lower(trim(name)) = 'test service'
  union all select 'attraction', id  from attractions where lower(trim(name)) = 'test service'
);
delete from loyalty_redemptions where (partner_type, partner_id) in (
  select 'service', id     from services    where lower(trim(name)) = 'test service'
  union all select 'retail', id      from retail      where lower(trim(name)) = 'test service'
  union all select 'restaurant', id  from restaurants where lower(trim(name)) = 'test service'
  union all select 'attraction', id  from attractions where lower(trim(name)) = 'test service'
);
delete from loyalty_programs where (partner_type, partner_id) in (
  select 'service', id     from services    where lower(trim(name)) = 'test service'
  union all select 'retail', id      from retail      where lower(trim(name)) = 'test service'
  union all select 'restaurant', id  from restaurants where lower(trim(name)) = 'test service'
  union all select 'attraction', id  from attractions where lower(trim(name)) = 'test service'
);
