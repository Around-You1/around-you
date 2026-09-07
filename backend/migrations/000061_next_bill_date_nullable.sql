-- Billing is paused by clearing next_bill_date (PausePartnerBilling, and the
-- COALESCE in OnPartnerActivated both rely on NULL meaning "not scheduled").
-- The original table created this column NOT NULL, so pausing silently failed.
-- Make it nullable to match the code's design.
alter table partner_subscription alter column next_bill_date drop not null;
