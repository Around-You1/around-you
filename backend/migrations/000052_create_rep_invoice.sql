-- Rep-issued invoices: the invoice a rep submits TO Around You for their monthly
-- commission. One row per submission. The server issues an authoritative,
-- per-rep sequential number so numbering can't collide across devices, and
-- snapshots the amount + banking details at submission time.
create table if not exists rep_invoice (
  id                  bigint generated always as identity primary key,
  rep_code            text   not null,
  seq                 int    not null,               -- per-rep sequence (1,2,3,…)
  invoice_number      text   not null unique,         -- AY-<repNum8>-<seq6>
  period_month        text   not null,                -- 'YYYY-MM' billing (prior) month
  amount_cents        int    not null default 0,      -- cumulative commission through period_month
  status              text   not null default 'Submitted' check (status in ('Submitted','Paid','Void')),
  rep_name            text,
  rep_email           text,
  residential_address text,
  bank_holder         text,
  bank_name           text,
  bank_account        text,
  bank_branch         text,
  created_at          timestamptz not null default now(),
  unique (rep_code, seq)
);
create index if not exists idx_rep_invoice_rep on rep_invoice (rep_code);

-- New table → enable + force RLS and revoke PostgREST roles (guarded for CI).
alter table rep_invoice enable row level security;
alter table rep_invoice force  row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on rep_invoice from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on rep_invoice from authenticated;
  end if;
end $$;
