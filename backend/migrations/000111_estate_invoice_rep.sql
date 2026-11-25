-- Estate pages have no agent-code field, so their profile rep (official_rep_code)
-- and the rep frozen on their already-issued invoices (bill_rep_code) were blank.
-- A blank rep HID their issued invoices from Billing > Invoices (e.g. AY-000042 for
-- the WeskusKuier agency) and dropped them from the forecast. Stamp the house
-- account (AROUNDYOU: a real, no-commission rep) on estate profiles and their
-- existing invoices so they show, bill, and can be resent.
UPDATE estate_agencies SET official_rep_code = 'AROUNDYOU'
 WHERE COALESCE(official_rep_code, '') = '';

UPDATE estate_agents SET official_rep_code = 'AROUNDYOU'
 WHERE COALESCE(official_rep_code, '') = '';

UPDATE invoice SET bill_rep_code = 'AROUNDYOU'
 WHERE partner_type IN ('estate_agency', 'estate_agent')
   AND COALESCE(bill_rep_code, '') = '';
