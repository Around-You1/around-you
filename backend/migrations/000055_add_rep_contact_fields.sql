-- Persist the rep's mobile and residential address from the New Rep Application
-- so the Admin Dashboard can show full contact details (name, ID, mobile,
-- email, residential address). Previously these were only emailed to admin.
-- Existing reps get '' until re-captured.
alter table users add column if not exists phone               text not null default '';
alter table users add column if not exists residential_address text not null default '';
