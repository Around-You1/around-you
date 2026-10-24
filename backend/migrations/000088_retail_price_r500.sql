-- Retail shops bill at R500/month (was carried over at the flat R300 service
-- price when SPAR + TOPS was moved into the new Retail category). Align every
-- existing retail subscription to R500 so the projection and invoicing match
-- the current price. NPO/PBO (free) and all other categories are untouched.
update partner_subscription
set monthly_cents = 50000,
    updated_at = now()
where partner_type = 'retail'
  and monthly_cents <> 50000
  and monthly_cents > 0;
