-- Suspended partners stay visible to guests/locals, but their contact number,
-- address and map directions are hidden until un-suspended. Independent of
-- is_active (accept/activate).
alter table restaurants    add column if not exists suspended boolean not null default false;
alter table services       add column if not exists suspended boolean not null default false;
alter table attractions    add column if not exists suspended boolean not null default false;
alter table retail         add column if not exists suspended boolean not null default false;
alter table nonprofits     add column if not exists suspended boolean not null default false;
alter table accommodations add column if not exists suspended boolean not null default false;
