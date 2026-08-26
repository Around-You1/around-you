-- Delivery log for every transactional email attempt (Resend). Lets the Admin
-- Billing tab surface failures (e.g. wrong sender domain, missing recipient).
create table if not exists email_log (
  id         bigserial primary key,
  to_addr    text not null default '',
  subject    text not null default '',
  status     text not null default '',   -- sent | failed | skipped
  detail     text not null default '',   -- error / reason when not sent
  created_at timestamptz not null default now()
);

create index if not exists idx_email_log_created on email_log (created_at desc);
