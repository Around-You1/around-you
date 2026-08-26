-- Restaurant "Atmosphere / Vibe" and "Features" multi-select attributes.
-- Existing restaurants automatically get empty arrays (nothing selected).
alter table restaurants add column if not exists atmosphere text[] not null default '{}';
alter table restaurants add column if not exists features   text[] not null default '{}';
