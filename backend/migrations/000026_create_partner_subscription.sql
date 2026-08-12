-- 000026_create_partner_subscription.sql
-- Phase 2 of Rep Commissions & Billing (see REP_BILLING_COMMISSIONS_SPEC.md).
-- One billing arrangement per partner, created at onboarding. Money is stored
-- in integer ZAR cents to avoid floating-point rounding on invoices/commissions.

create table if not exists partner_subscription (
  id             bigint generated always as identity primary key,
  partner_type   text not null check (partner_type in ('accommodation','restaurant','service','attraction')),
  partner_id     bigint not null,
  plan           text not null check (plan in ('tier','booking')),
  tier           int,                    -- 1..4; null for booking plan
  audience       text,                   -- 'Guest Only' | 'Local' | 'Both' | null (accommodation)
  monthly_cents  int  not null default 0,-- fixed monthly amount in ZAR cents (booking's +10% is added per billing period)
  rep_code       text,                   -- signing rep (users.rep_code); null if none
  status         text not null default 'Active' check (status in ('Active','Paused','Cancelled')),
  auto_renew     boolean not null default true,
  started_at     timestamptz not null default now(),
  next_bill_date date not null default ((now() at time zone 'utc')::date + 1),
  cancelled_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (partner_type, partner_id)       -- one subscription record per partner
);

create index if not exists idx_partner_subscription_rep_code on partner_subscription (rep_code);
create index if not exists idx_partner_subscription_next_bill
  on partner_subscription (next_bill_date) where status = 'Active';

-- New table → enable + force RLS and revoke the PostgREST roles (repo gotcha).
-- Guarded so it stays portable to a vanilla Postgres (CI) with no anon role.
alter table partner_subscription enable row level security;
alter table partner_subscription force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on partner_subscription from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on partner_subscription from authenticated;
  end if;
end $$;
