-- EFT payment option for all partner types. When true, the Guest/Local pages
-- show "Please contact for more info" instead of a specific payment badge.
alter table restaurants add column if not exists payment_eft boolean not null default false;
alter table services    add column if not exists payment_eft boolean not null default false;
alter table attractions add column if not exists payment_eft boolean not null default false;
