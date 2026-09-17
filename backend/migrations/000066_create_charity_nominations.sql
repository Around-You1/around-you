-- Charity a partner nominates in the Official Use section, captured as free text
-- (name, address, contact number) instead of the old fixed category checkboxes.
-- One row per partner (their current nomination). province + partner_name are
-- denormalised from the partner so the monthly per-province report needs no
-- cross-table joins. created_at is (re)set whenever the nomination is saved, so
-- the report can list what was presented in a given month.
create table if not exists charity_nominations (
  partner_type    text   not null,
  partner_id      bigint not null,
  partner_name    text   not null default '',
  province        text   not null default '',
  charity_name    text   not null default '',
  charity_address text   not null default '',
  charity_contact text   not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (partner_type, partner_id)
);

create index if not exists idx_charity_nom_province on charity_nominations (province);
create index if not exists idx_charity_nom_created  on charity_nominations (created_at);
