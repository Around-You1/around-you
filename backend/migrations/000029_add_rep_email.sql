-- 000029_add_rep_email.sql
-- A real contact email for reps. The users.email column holds a synthetic
-- login address for reps (rep00000001@reps.aroundyou.internal), so this
-- separate column stores the address their monthly commission statements are
-- emailed to. Nullable — reps without one simply don't receive emailed
-- statements (they remain viewable by the SuperAdmin in the Billing tab).
--
-- users already has RLS enabled/forced (migration 000024); no RLS change needed.

alter table users add column if not exists rep_email text;
