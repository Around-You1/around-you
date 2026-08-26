-- Collapse the 4-tier model to 2 tiers, mapping by price so bills are preserved:
--   old Tier 4 (R300) -> Tier 2 (R300)   [top tier]
--   old Tier 3 (R200) -> Tier 1 (R200)   [entry tier]
--   old Tier 1/2       -> Tier 1 (R200)
-- New prices: Tier 1 = R200, Tier 2 = R300, audience "Both" = R400.
-- Accommodations keep their (unit-based) pricing but are now labelled Tier 2.

-- 1) Partner access-level labels (single CASE avoids re-matching updated rows).
update restaurants set access_level = case
    when access_level = 'Tier 4' then 'Tier 2'
    when access_level in ('Tier 3', 'Tier 2') then 'Tier 1'
    else access_level end
  where access_level like 'Tier %';

update services set access_level = case
    when access_level = 'Tier 4' then 'Tier 2'
    when access_level in ('Tier 3', 'Tier 2') then 'Tier 1'
    else access_level end
  where access_level like 'Tier %';

update attractions set access_level = case
    when access_level = 'Tier 4' then 'Tier 2'
    when access_level in ('Tier 3', 'Tier 2') then 'Tier 1'
    else access_level end
  where access_level like 'Tier %';

update accommodations set access_level = 'Tier 2'
  where access_level in ('Tier 3', 'Tier 4');

-- 2) Subscription tier numbers (one CASE pass on the original value).
update partner_subscription set tier = case
    when tier >= 4 then 2
    when tier = 3 then 1
    when tier = 2 then 1
    else tier            -- Tier 1 stays 1; booking (0) stays 0
  end;

-- 3) Reprice tier-plan restaurant/service/attraction subscriptions to new amounts.
--    Accommodation (unit pricing), booking and realestate plans are left as-is.
update partner_subscription set monthly_cents = case
    when audience = 'Both' then 40000
    when tier = 2 then 30000
    else 20000
  end
  where plan = 'tier' and partner_type in ('restaurant', 'service', 'attraction');
