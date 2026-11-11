-- Accommodations can opt in to also being shown to Locals (as
-- "Accommodation/Caravan Parks"). Default false: existing and new
-- accommodations stay guest-only until the owner/admin ticks the box.
alter table accommodations
  add column if not exists show_to_locals boolean not null default false;

create index if not exists idx_accommodations_show_to_locals
  on accommodations (show_to_locals) where show_to_locals = true;
