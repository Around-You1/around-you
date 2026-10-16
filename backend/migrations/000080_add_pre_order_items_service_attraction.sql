-- Pre-orders for Business/Services and Attractions (previously restaurant-only).
alter table services    add column if not exists pre_order_items jsonb not null default '[]'::jsonb;
alter table attractions add column if not exists pre_order_items jsonb not null default '[]'::jsonb;
