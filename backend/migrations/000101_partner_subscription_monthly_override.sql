-- Per-partner monthly price override: an admin-set negotiated monthly fee that
-- wins over the computed plan price and survives profile re-saves. NULL = use
-- the standard computed price. The November launch promo still applies on top.
alter table partner_subscription add column if not exists monthly_cents_override integer;
