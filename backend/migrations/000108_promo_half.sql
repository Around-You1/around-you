-- Per-partner override for the November launch 50% promo.
-- NULL = automatic (based on sign-up date), true = force on, false = force off.
ALTER TABLE partner_subscription ADD COLUMN IF NOT EXISTS promo_half boolean;
