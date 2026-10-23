-- Retail and NPO/PBO as their own independent tables (structural copies of services).
create table if not exists retail (like services including all);
create table if not exists nonprofits (like services including all);

drop trigger if exists trg_retail_updated_at on retail;
create trigger trg_retail_updated_at
  before update on retail
  for each row execute function set_updated_at();

drop trigger if exists trg_nonprofits_updated_at on nonprofits;
create trigger trg_nonprofits_updated_at
  before update on nonprofits
  for each row execute function set_updated_at();

-- Allow the new partner types where entity/partner type is constrained.
alter table ratings drop constraint if exists ratings_entity_type_check;
alter table ratings add constraint ratings_entity_type_check
  check (entity_type = any (array['restaurant','service','attraction','retail','nonprofit']));

alter table partner_subscription drop constraint if exists partner_subscription_partner_type_check;
alter table partner_subscription add constraint partner_subscription_partner_type_check
  check (partner_type = any (array['accommodation','restaurant','service','attraction','estate_agency','estate_agent','retail','nonprofit']));
