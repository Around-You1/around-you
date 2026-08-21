-- Properties can now belong to a standalone agent (agent_id set) without an
-- agency (agency_id null). Agencies keep working exactly as before.
alter table estate_properties alter column agency_id drop not null;
create index if not exists idx_estate_properties_agent on estate_properties (agent_id);
