-- Self-service partner applications submitted via the public /apply web form.
-- A prospective partner (referred by a rep's link) fills in the form; the
-- submission is stored here as Pending and emailed to Accounts + the rep. A
-- rep/SuperAdmin reviews it in the dashboard and onboards the partner. Fields
-- vary by category, so the full submission is kept as JSON in `payload`, with a
-- few common columns pulled out for listing/filtering.
create table if not exists partner_applications (
    id             bigserial primary key,
    category       text not null default '',   -- restaurant|service|attraction|accommodation|estate
    rep_code       text not null default '',
    business_name  text not null default '',
    contact_name   text not null default '',
    contact_email  text not null default '',
    contact_number text not null default '',
    province       text not null default '',
    payload        jsonb not null default '{}',
    status         text not null default 'Pending', -- Pending|Onboarded|Declined
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index if not exists partner_applications_cat_status_idx
    on partner_applications (category, status);
create index if not exists partner_applications_created_idx
    on partner_applications (created_at desc);
