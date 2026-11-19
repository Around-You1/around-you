-- Suspended estate pages stay visible to guests/locals, but their contact
-- number, address and map directions are hidden until un-suspended. Mirrors
-- 000102_partner_suspended.sql for the Real Estate tables (agencies + agents).
alter table estate_agencies add column if not exists suspended boolean not null default false;
alter table estate_agents   add column if not exists suspended boolean not null default false;
