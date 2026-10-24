-- Optional admin "copy me" address: every partner invoice / welcome email is
-- BCC'd here so the admin always receives their own copy. Blank = no copy.
alter table invoice_settings add column if not exists copy_email text not null default '';
