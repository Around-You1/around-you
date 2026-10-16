-- Non Profit Organizations reuse the Services entity, flagged with is_nonprofit.
-- They appear in their own Admin and Guest tabs (the Guest tab is "Coming Soon"
-- until go-live) and are excluded from the normal Business/Services lists.
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_nonprofit boolean NOT NULL DEFAULT false;
