-- 000042_accommodation_units.sql
-- Option A pricing for accommodations by number of units/rooms:
--   1–5 units  -> tier pricing (Tier 4 default, R300 / R400 for Both)
--   6–10 units -> R500   ('units' plan)
--   11–20      -> R800
--   21–40      -> R1,200
--   40+        -> Custom Quote (billed manually)
-- Adds the units count and allows the new 'units' plan on subscriptions.
alter table accommodations add column if not exists units int not null default 1;

alter table partner_subscription drop constraint if exists partner_subscription_plan_check;
alter table partner_subscription add  constraint partner_subscription_plan_check
  check (plan in ('tier','booking','realestate','units'));
