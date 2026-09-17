-- Real Estate redesign: extra per-property criteria captured on the Estate
-- Agent's Admin form, plus an image carousel for the agent's own page.
--
--   code               agent's contact/listing code (users contact the agent
--                      rather than going to the listing address themselves)
--   show_house         marks the listing as one of this week's show houses
--   show_house_number  the show-house slot/order (1-10) when show_house is true
--   listing_url        a linkable URL for the full listing
alter table estate_properties add column if not exists code text;
-- Price is captured as free text on the new form ("R 1 200 000", "R 6 000 /
-- month", "POA", ...). price_cents stays for any numeric use; price_text keeps
-- exactly what the agent typed, for display.
alter table estate_properties add column if not exists price_text text;
alter table estate_properties add column if not exists show_house boolean not null default false;
alter table estate_properties add column if not exists show_house_number int;
alter table estate_properties add column if not exists listing_url text;

-- The agent page shows a single hero photo (photo_url, already present) plus a
-- carousel of up to 10 additional images.
alter table estate_agents add column if not exists image_urls text[] not null default '{}';
