-- Seed the internal "Around You 12" rep (Rep00000012).
--
-- Partners onboarded under this code are billed at HALF the normal monthly cost
-- (see billing.EnsureSubscription / appdb.IsHalfPriceRep) and the rep earns NO
-- commission (see appdb.NoCommissionRepCodesLower). Its partners are otherwise
-- real, billed and counted exactly like any other partner.
--
-- Idempotent: only inserts when the code does not already exist. The login_code
-- is a random 12-char access code from the same alphabet the app uses; a
-- SuperAdmin can view or resend it from the Reps tab.
insert into users (email, role, full_name, rep_code, rep_status, login_code, is_team_leader)
select
  'rep00000012@reps.aroundyou.internal', 'Rep', 'Around You 12', 'Rep00000012', 'Active',
  (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
     from generate_series(1, 12)),
  false
where not exists (select 1 from users where lower(rep_code) = 'rep00000012');
