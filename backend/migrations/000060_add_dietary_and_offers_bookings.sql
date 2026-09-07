-- Restaurant "Dietary options" (multi-select, mirrors atmosphere/features) and
-- an "offers bookings" flag captured from the self-service application form for
-- restaurants, services and attractions. Existing rows default to empty / false.
alter table restaurants add column if not exists dietary_options text[] not null default '{}';
alter table restaurants add column if not exists offers_bookings boolean not null default false;
alter table services    add column if not exists offers_bookings boolean not null default false;
alter table attractions add column if not exists offers_bookings boolean not null default false;
