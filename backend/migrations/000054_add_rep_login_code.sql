-- 12-character random access code that a Rep must enter (in addition to their
-- full name + rep code) to sign in. Generated when the application is submitted,
-- emailed to the rep in the welcome email when a SuperAdmin activates them.
-- Existing reps get '' — the login check is skipped while it's blank, so nobody
-- is locked out until a code is issued to them.
alter table users add column if not exists login_code text not null default '';
