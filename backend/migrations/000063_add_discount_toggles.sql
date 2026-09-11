-- Per-audience discount toggles. Each bookable partner (restaurant/service/
-- attraction) now has an explicit on/off switch for the Guest discount and the
-- Local discount. When false, that audience sees NO discount on their page even
-- if the *_discount_offered/_code text columns still hold values.
--
-- Backfill: any profile that already had a non-empty discount keeps showing it,
-- so this change is invisible to existing partners until an admin/rep unticks it.
alter table restaurants add column if not exists discount_enabled       boolean not null default false;
alter table restaurants add column if not exists local_discount_enabled boolean not null default false;
alter table services    add column if not exists discount_enabled       boolean not null default false;
alter table services    add column if not exists local_discount_enabled boolean not null default false;
alter table attractions add column if not exists discount_enabled       boolean not null default false;
alter table attractions add column if not exists local_discount_enabled boolean not null default false;

update restaurants set discount_enabled       = true where coalesce(discount_offered, '')       <> '';
update restaurants set local_discount_enabled = true where coalesce(local_discount_offered, '') <> '';
update services    set discount_enabled       = true where coalesce(discount_offered, '')       <> '';
update services    set local_discount_enabled = true where coalesce(local_discount_offered, '') <> '';
update attractions set discount_enabled       = true where coalesce(discount_offered, '')       <> '';
update attractions set local_discount_enabled = true where coalesce(local_discount_offered, '') <> '';
