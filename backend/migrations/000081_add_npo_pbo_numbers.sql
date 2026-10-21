-- NPO / PBO profiles (services flagged is_nonprofit) capture their registration
-- numbers: an NPO Number and a PBO Number.
alter table services add column if not exists npo_number text not null default '';
alter table services add column if not exists pbo_number text not null default '';
