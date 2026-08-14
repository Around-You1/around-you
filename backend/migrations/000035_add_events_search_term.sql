-- 000035_add_events_search_term.sql
-- Capture the search term on search events so the admin can see top searches
-- and zero-result searches by keyword. Nullable; only set on search events.

alter table events add column if not exists search_term text;
