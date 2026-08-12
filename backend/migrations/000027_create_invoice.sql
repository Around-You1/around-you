-- 000027_create_invoice.sql
-- Phase 3 of Rep Commissions & Billing (see REP_BILLING_COMMISSIONS_SPEC.md).
-- Invoices + line items. Money in integer ZAR cents. VAT columns kept but 0
-- until Around You is VAT-registered. Idempotent per (subscription_id,
-- period_start) so the monthly billing run can never double-bill a period.

create sequence if not exists invoice_number_seq;

create table if not exists invoice (
  id                   bigint generated always as identity primary key,
  invoice_number       text   not null unique,
  subscription_id      bigint not null references partner_subscription(id),
  partner_type         text   not null,
  partner_id           bigint not null,
  period_start         date   not null,
  period_end           date   not null,
  subtotal_cents       int    not null default 0,
  vat_cents            int    not null default 0,  -- 0 until VAT-registered
  total_cents          int    not null default 0,
  status               text   not null default 'Issued' check (status in ('Issued','Paid','Overdue','Void')),
  -- billing-identity snapshot at issue time (so history stays correct if the
  -- partner record later changes)
  bill_name            text,
  bill_holding_company text,
  bill_reg_number      text,
  bill_vat_number      text,
  bill_rep_name        text,
  bill_rep_code        text,
  bill_email           text,
  issued_at            timestamptz not null default now(),
  due_at               date,
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  unique (subscription_id, period_start)
);
create index if not exists idx_invoice_partner       on invoice (partner_type, partner_id);
create index if not exists idx_invoice_subscription  on invoice (subscription_id);
create index if not exists idx_invoice_rep_code      on invoice (bill_rep_code);

create table if not exists invoice_line_item (
  id         bigint generated always as identity primary key,
  invoice_id bigint not null references invoice(id) on delete cascade,
  description text  not null,
  qty        int   not null default 1,
  unit_cents int   not null default 0,
  line_cents int   not null default 0
);
create index if not exists idx_invoice_line_item_invoice on invoice_line_item (invoice_id);

-- New tables → enable + force RLS and revoke PostgREST roles (guarded for CI).
alter table invoice            enable row level security;
alter table invoice            force  row level security;
alter table invoice_line_item  enable row level security;
alter table invoice_line_item  force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on invoice from anon;
    revoke all on invoice_line_item from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on invoice from authenticated;
    revoke all on invoice_line_item from authenticated;
  end if;
end $$;
