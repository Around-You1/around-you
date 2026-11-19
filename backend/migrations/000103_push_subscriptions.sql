-- Web Push subscriptions: one anonymous push token per device, linked to its
-- user (a Local keeps the same token as long as they stay on the same phone/
-- browser). Lets a SuperAdmin push "new deals" or a draw-winner alert without
-- ever holding an email or cell number.
create table if not exists push_subscriptions (
  id         bigserial primary key,
  user_id    bigint references users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);
