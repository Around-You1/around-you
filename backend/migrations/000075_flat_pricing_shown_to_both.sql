-- 000075_flat_pricing_shown_to_both.sql
-- Flat R300 model (Oct 2026): one price for all information aimed at both guests
-- and locals. Audience (Guest/Local/Both) and the Basic/Premium tier no longer
-- affect price or visibility, so every partner is set to "Both" at Tier 2
-- (Premium). Booking partners keep their Booking access level (per-booking
-- commissions still apply); accommodation unit bands and estate pages are left
-- untouched.

-- Partner records: shown to Both, Premium tier. Preserve the Booking access level.
update restaurants    set guest_type = 'Both',
                          access_level = case when access_level = 'Booking' then 'Booking' else 'Tier 2' end;
update services       set guest_type = 'Both',
                          access_level = case when access_level = 'Booking' then 'Booking' else 'Tier 2' end;
update attractions    set guest_type = 'Both',
                          access_level = case when access_level = 'Booking' then 'Booking' else 'Tier 2' end;
update accommodations set guest_type = 'Both',
                          access_level = case when access_level = 'Booking' then 'Booking' else 'Tier 2' end;

-- Re-price existing subscriptions to the flat R300 (30000 cents) and audience
-- 'Both'. Only the flat 'tier' and 'booking' plans change; accommodation unit
-- bands ('units') and estate pages ('realestate') keep their own pricing.
update partner_subscription
   set monthly_cents = 30000,
       audience      = 'Both',
       tier          = 2,
       updated_at    = now()
 where plan in ('tier', 'booking');
