-- 000028_create_commission.sql
-- Phase 5 of Rep Commissions & Billing (see REP_BILLING_COMMISSIONS_SPEC.md).
-- The commission ledger. One row per (invoice, rep, type) so every rand a rep
-- earns is traceable to a partner, period, and invoice. Money in ZAR cents;
-- rate in basis points (3000 = 30%, 1000 = 10%).

create table if not exists commission (
  id                  bigint generated always as identity primary key,
  rep_code            text   not null,               -- who earns this
  type                text   not null check (type in ('own','override')),
  source_partner_type text,
  source_partner_id   bigint,
  source_rep_code     text,                           -- override: the downline rep who made the sale
  invoice_id          bigint references invoice(id) on delete cascade,
  period_start        date,
  base_cents          int    not null default 0,      -- the amount the partner paid, that this % is taken of
  rate_bps            int    not null default 0,       -- basis points: 3000 = 30%, 1000 = 10%
  amount_cents        int    not null default 0,
  status              text   not null default 'Accrued' check (status in ('Accrued','Paid')),
  created_at          timestamptz not null default now(),
  unique (invoice_id, rep_code, type)                  -- idempotent accrual per invoice
);
create index if not exists idx_commission_rep    on commission (rep_code);
create index if not exists idx_commission_period on commission (period_start);

-- New table → enable + force RLS and revoke PostgREST roles (guarded for CI).
alter table commission enable row level security;
alter table commission force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on commission from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on commission from authenticated;
  end if;
end $$;
