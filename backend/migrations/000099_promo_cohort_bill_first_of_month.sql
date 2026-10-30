-- Promo cohort alignment: partners who joined during the Sept/Oct 2026 free promo
-- all bill on the 1st of each month, starting 1 Nov 2026 (their first payable run).
-- Their recurring anchor had been set to each partner's own activation anniversary
-- (dates scattered across Nov); pull every one still due within Nov 2026 back to
-- 1 Nov so they bill together on the 1st. The monthly run then advances them to
-- 1 Dec, 1 Jan, and so on.
--
-- Partners activated AFTER this keep anniversary-of-activation billing (set at
-- activation time), so this one-off touches only the current promo cohort.
--
-- Scoped to active, paid, non-NPO subscriptions whose next bill is still within
-- Nov 2026, so it can never pull an already-billed (advanced to Dec+) partner back
-- and double-bill them.
UPDATE partner_subscription
   SET next_bill_date = DATE '2026-11-01',
       updated_at = now()
 WHERE status = 'Active'
   AND monthly_cents > 0
   AND partner_type <> 'nonprofit'
   AND next_bill_date IS NOT NULL
   AND next_bill_date >= DATE '2026-11-01'
   AND next_bill_date <  DATE '2026-12-01';
