-- Separate "Local" discount (code + description) for restaurants, services and
-- attractions. Guests see discount_offered/discount_code; Locals see the
-- local_* variants. Existing single discounts are copied into the local_*
-- columns so current listings keep showing a discount to Locals until the
-- partner differentiates them.
alter table restaurants add column if not exists local_discount_offered text not null default '';
alter table restaurants add column if not exists local_discount_code    text not null default '';
alter table services    add column if not exists local_discount_offered text not null default '';
alter table services    add column if not exists local_discount_code    text not null default '';
alter table attractions add column if not exists local_discount_offered text not null default '';
alter table attractions add column if not exists local_discount_code    text not null default '';

update restaurants set local_discount_offered = discount_offered where local_discount_offered = '' and coalesce(discount_offered, '') <> '';
update restaurants set local_discount_code    = discount_code    where local_discount_code    = '' and coalesce(discount_code, '')    <> '';
update services    set local_discount_offered = discount_offered where local_discount_offered = '' and coalesce(discount_offered, '') <> '';
update services    set local_discount_code    = discount_code    where local_discount_code    = '' and coalesce(discount_code, '')    <> '';
update attractions set local_discount_offered = discount_offered where local_discount_offered = '' and coalesce(discount_offered, '') <> '';
update attractions set local_discount_code    = discount_code    where local_discount_code    = '' and coalesce(discount_code, '')    <> '';
