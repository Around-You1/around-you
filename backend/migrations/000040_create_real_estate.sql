-- 000040_create_real_estate.sql
-- Real Estate & Rentals subsystem: a fully isolated category with its own tables.
-- Estate agencies, their agents, and their property listings. Billing is a flat
-- R300/month per PAGE (agency + each agent), routed through the existing
-- partner_subscription/invoice/commission machinery via two new partner_type
-- values ('estate_agency','estate_agent') and a new plan ('realestate').

-- 1) Widen the partner_subscription CHECK constraints so real-estate pages can
--    carry a subscription. Drop-and-readd the (auto-named) checks; guarded so a
--    fresh CI DB (which has the original names) and an already-migrated DB both work.
alter table partner_subscription drop constraint if exists partner_subscription_partner_type_check;
alter table partner_subscription add  constraint partner_subscription_partner_type_check
  check (partner_type in ('accommodation','restaurant','service','attraction','estate_agency','estate_agent'));
alter table partner_subscription drop constraint if exists partner_subscription_plan_check;
alter table partner_subscription add  constraint partner_subscription_plan_check
  check (plan in ('tier','booking','realestate'));

-- 2) Estate Agencies — a "partner-like" page. Carries the full Official Use block
--    (billing attribution + rep commission) and the columns GenerateInvoice reads.
create table if not exists estate_agencies (
  id                            bigserial primary key,
  name                          text not null default '',
  description                   text not null default '',
  address                       text not null default '',
  province                      text not null default '',
  country                       text not null default '',
  postal_code                   text not null default '',
  contact_number                text not null default '',
  email                         text not null default '',
  latitude                      double precision,
  longitude                     double precision,
  image_url                     text not null default '',
  image_urls                    text[] not null default '{}',
  create_agent_pages            boolean not null default false,
  profile_reference_code        text unique,
  profile_reference_code_active boolean not null default true,
  edit_code                     text not null default upper(substr(md5(random()::text), 1, 10)),
  official_holding_company      text not null default '',
  official_contact_name         text not null default '',
  official_contact_number       text not null default '',
  official_email                text not null default '',
  official_rep_code             text not null default '',
  official_rep_name             text not null default '',
  company_reg_number            text not null default '',
  company_vat_number            text not null default '',
  is_active                     boolean not null default true,
  is_duplicate                  boolean not null default false,
  duplicate_reason              text not null default '',
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- 3) Estate Agents — individual pages under an agency, each billed R300. Full
--    Official Use block so per-agent billing can be attributed independently.
create table if not exists estate_agents (
  id                            bigserial primary key,
  agency_id                     bigint not null references estate_agencies(id) on delete cascade,
  name                          text not null default '',
  photo_url                     text not null default '',
  contact_number                text not null default '',
  email                         text not null default '',
  bio                           text not null default '',
  profile_reference_code        text unique,
  profile_reference_code_active boolean not null default true,
  edit_code                     text not null default upper(substr(md5(random()::text), 1, 10)),
  official_holding_company      text not null default '',
  official_contact_name         text not null default '',
  official_contact_number       text not null default '',
  official_email                text not null default '',
  official_rep_code             text not null default '',
  official_rep_name             text not null default '',
  company_reg_number            text not null default '',
  company_vat_number            text not null default '',
  is_active                     boolean not null default true,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- 4) Property listings under an agency, optionally assigned to an agent.
create table if not exists estate_properties (
  id             bigserial primary key,
  agency_id      bigint not null references estate_agencies(id) on delete cascade,
  agent_id       bigint references estate_agents(id) on delete set null,
  title          text not null default '',
  property_type  text not null default '',
  plot_size_m2   numeric,
  house_size_m2  numeric,
  bedrooms       int,
  bathrooms      int,
  garages        int,
  features       text[] not null default '{}',
  price_cents    bigint not null default 0,
  listing_type   text not null default 'sale',   -- 'sale' | 'rent'
  address        text not null default '',
  province       text not null default '',
  country        text not null default '',
  postal_code    text not null default '',
  latitude       double precision,
  longitude      double precision,
  description    text not null default '',
  image_url      text not null default '',
  image_urls     text[] not null default '{}',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_estate_agents_agency        on estate_agents (agency_id);
create index if not exists idx_estate_properties_agency     on estate_properties (agency_id);
create index if not exists idx_estate_properties_agent      on estate_properties (agent_id);
create index if not exists idx_estate_properties_active     on estate_properties (is_active);

-- 5) RLS lockdown on all three (enable + force, revoke PostgREST roles), guarded
--    for CI's plain postgres image.
do $$
declare t text;
begin
  foreach t in array array['estate_agencies','estate_agents','estate_properties'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on %I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on %I from authenticated', t);
    end if;
  end loop;
end $$;
