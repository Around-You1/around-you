-- Restaurant "Pre-Orders" (takeaway/delivery): a jsonb list of menu items the
-- restaurant offers for pre-order, each with name, description, price and a
-- lead time in minutes. Same storage pattern as booking_items.
alter table restaurants add column if not exists pre_order_items jsonb not null default '[]'::jsonb;
