-- Charity focus areas a partner supports, captured in the Official Use section.
-- One row per (partner, category). created_at lets us tally new selections per
-- month for the Admin Analytics page. Works for every partner type.
create table if not exists partner_charity (
  partner_type text not null,
  partner_id   bigint not null,
  category     text not null,
  created_at   timestamptz not null default now(),
  primary key (partner_type, partner_id, category)
);

create index if not exists idx_partner_charity_created  on partner_charity (created_at);
create index if not exists idx_partner_charity_partner  on partner_charity (partner_type, partner_id);
