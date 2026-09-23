-- Free-text Trading Hours and Public Holidays for the places guests visit.
-- Shown on the Admin, Guest, Local and Partner pages and entered via the
-- partner forms, rep onboarding and the public application form.
alter table restaurants add column if not exists trading_hours   text;
alter table restaurants add column if not exists public_holidays text;
alter table services    add column if not exists trading_hours   text;
alter table services    add column if not exists public_holidays text;
alter table attractions add column if not exists trading_hours   text;
alter table attractions add column if not exists public_holidays text;
