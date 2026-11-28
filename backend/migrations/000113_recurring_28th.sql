-- 000113_recurring_28th.sql
-- Recurring billing moves to a single monthly cycle: every ACCEPTED partner is
-- invoiced for the coming month, with the invoice SENT on the 28th of the
-- preceding month (invoice dated the 1st of the covered month, due the 3rd).
-- Re-anchor every ACTIVE, paid partner that has already been issued a first
-- invoice (i.e. accepted) to 1 December 2026 -- INCLUDING those still awaiting
-- their first pro-rata payment (next_bill_date was previously NULL until
-- activation) -- so the December batch goes out now. Partners not yet accepted
-- (no invoice) and free/complimentary (R0) listings are untouched; the billing
-- run re-checks eligibility and GenerateInvoice skips any period already invoiced
-- (e.g. Ezy Bikes' December invoice), so no one is double-billed.
UPDATE partner_subscription ps
SET next_bill_date = DATE '2026-12-01',
    updated_at = now()
WHERE ps.status = 'Active'
  AND ps.monthly_cents > 0
  AND EXISTS (SELECT 1 FROM invoice i WHERE i.subscription_id = ps.id);
