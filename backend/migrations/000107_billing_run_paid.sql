-- Tracks which partners a SuperAdmin has marked "paid" for a given billing-run
-- date, for the admin "New Billing Run" view. Purely a visual tracker
-- (green = paid, empty = outstanding); it does NOT touch invoices, reminders or
-- partner status. Keyed by bill_date so each monthly run starts fresh.
CREATE TABLE IF NOT EXISTS billing_run_paid (
    partner_type TEXT        NOT NULL,
    partner_id   BIGINT      NOT NULL,
    bill_date    DATE        NOT NULL,
    paid_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (partner_type, partner_id, bill_date)
);
