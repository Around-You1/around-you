-- Ward councillors post geo-scoped alerts to residents/partners in their wards.
-- A registration starts 'pending'; a SuperAdmin approves it (which issues the
-- access code) → 'active'. 'disabled' revokes access.
CREATE TABLE IF NOT EXISTS ward_councillors (
    id           BIGSERIAL PRIMARY KEY,
    full_name    TEXT        NOT NULL,
    id_number    TEXT        NOT NULL DEFAULT '',
    staff_number TEXT        NOT NULL DEFAULT '',
    postal_codes TEXT[]      NOT NULL DEFAULT '{}',
    code_hash    TEXT        NOT NULL DEFAULT '',
    status       TEXT        NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at  TIMESTAMPTZ,
    approved_by  TEXT        NOT NULL DEFAULT ''
);
-- Ward-scoped inbox messages: NULL/empty = everyone (existing behaviour),
-- otherwise only viewers whose postal code is in the list.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS postal_codes TEXT[];
