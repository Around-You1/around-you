-- An optional end date/time for a broadcast. After it passes, the message is
-- removed from the in-app inbox on every device (RecentNotifications deletes
-- expired rows). NULL means it never expires.
alter table notifications add column if not exists expires_at timestamptz;
