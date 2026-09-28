-- Adds user_id to events so a login event (see auth.issueSession) can be
-- tied back to the specific user who logged in. Needed for the Admin
-- Dashboard's "Locals" analytics: a dropdown of individual local guests and
-- their sign-in totals per day/week/month/year, which requires knowing WHICH
-- local logged in, not just the aggregate area/count that "events" already
-- tracked.
alter table events add column if not exists user_id bigint references users (id) on delete set null;
create index if not exists idx_events_user on events (user_id);
