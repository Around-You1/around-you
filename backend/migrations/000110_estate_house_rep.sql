-- Estate pages (agencies + agents) are onboarded directly by Around You and have
-- no agent-code field, so their rep was stored empty. An empty rep dropped them
-- from the billable forecast even when Active with a price set. Bill them under
-- the house account (AROUNDYOU: a real, no-commission rep), and give any Active
-- estate page that is missing a recurring anchor one, so it joins the monthly run.
UPDATE partner_subscription
   SET rep_code = 'AROUNDYOU', updated_at = now()
 WHERE partner_type IN ('estate_agency', 'estate_agent')
   AND COALESCE(rep_code, '') = '';

UPDATE partner_subscription ps
   SET next_bill_date = GREATEST(
           COALESCE((SELECT MAX(period_end) FROM invoice WHERE subscription_id = ps.id), DATE '2026-12-01'),
           DATE '2026-12-01'),
       updated_at = now()
 WHERE ps.partner_type IN ('estate_agency', 'estate_agent')
   AND ps.status = 'Active'
   AND ps.next_bill_date IS NULL;
