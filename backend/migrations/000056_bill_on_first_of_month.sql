-- SUPERSEDED — intentionally a no-op.
-- This migration originally snapped every partner to bill on the 1st of the
-- month. That rule was reversed: partners are billed on their activation-day
-- anniversary (the day they went live), so there is nothing to change here.
-- Kept as a no-op to preserve migration numbering.
select 1;
