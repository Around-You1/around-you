-- Persist the rep's SA ID / Passport number captured on the New Rep Application
-- so it can be auto-filled on the rep's invoice. Previously this was only
-- emailed to admin, never stored. Existing reps get '' until it's re-captured.
alter table users add column if not exists id_number text not null default '';
