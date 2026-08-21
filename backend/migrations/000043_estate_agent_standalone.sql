-- Estate agents become standalone, self-paying profiles (not required to belong
-- to an agency). They capture their own agency name, address and map location so
-- guests/locals get a Directions button.

alter table estate_agents alter column agency_id drop not null;

alter table estate_agents add column if not exists agency_name text not null default '';
alter table estate_agents add column if not exists address     text not null default '';
alter table estate_agents add column if not exists province    text not null default '';
alter table estate_agents add column if not exists postal_code text not null default '';
alter table estate_agents add column if not exists latitude    double precision;
alter table estate_agents add column if not exists longitude   double precision;

create index if not exists idx_estate_agents_active on estate_agents (is_active);
