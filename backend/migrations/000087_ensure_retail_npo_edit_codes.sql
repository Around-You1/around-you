-- Guarantee retail/nonprofit profiles auto-generate a Partner Edit Code, and
-- backfill any rows that are missing one.
alter table retail     alter column edit_code set default upper(substr(md5(random()::text), 1, 12));
alter table nonprofits alter column edit_code set default upper(substr(md5(random()::text), 1, 12));
update retail     set edit_code = upper(substr(md5(random()::text), 1, 12)) where coalesce(edit_code, '') = '';
update nonprofits set edit_code = upper(substr(md5(random()::text), 1, 12)) where coalesce(edit_code, '') = '';
