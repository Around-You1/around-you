-- 000033_create_invoice_settings.sql
-- A single row of settings that brand your invoices: business details, bank
-- details, payment terms, and logo. Edited by the SuperAdmin in the Billing tab
-- and rendered on every invoice so partners know who to pay and how.

create table if not exists invoice_settings (
  id                int primary key default 1 check (id = 1),
  business_name     text not null default 'Around You',
  address           text not null default '',
  contact_email     text not null default '',
  contact_phone     text not null default '',
  reg_number        text not null default '',
  vat_number        text not null default '',
  bank_name         text not null default '',
  account_name      text not null default '',
  account_number    text not null default '',
  branch_code       text not null default '',
  payment_reference text not null default '',
  payment_terms     text not null default 'Payment due immediately.',
  logo_url          text not null default '',
  updated_at        timestamptz not null default now()
);
insert into invoice_settings (id) values (1) on conflict (id) do nothing;

-- New table → enable + force RLS and revoke PostgREST roles (guarded for CI).
alter table invoice_settings enable row level security;
alter table invoice_settings force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on invoice_settings from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on invoice_settings from authenticated;
  end if;
end $$;
