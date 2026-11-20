-- Broadcast push notifications are logged here so the app can show an in-app
-- inbox (a Local who dismisses or misses the pop-up can still read the message).
-- Only broadcasts (audience 'local' / 'all') are recorded; one-device test sends
-- are not.
create table if not exists notifications (
  id         bigserial primary key,
  title      text not null default '',
  body       text not null default '',
  url        text not null default '/',
  audience   text not null default 'local',
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_created on notifications (created_at desc);
