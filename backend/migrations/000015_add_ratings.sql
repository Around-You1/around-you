-- ============================================================================
-- 000015_add_ratings
-- ============================================================================
-- Star ratings (1-5) for Restaurant, Service, and Attraction — never for
-- Accommodation, since guests staying there never see their own listing.
--
-- One vote per voter per partner, enforced at the database level via the
-- unique constraint below. voter_key identifies who voted:
--   - Local Guest: their lowercased email (a real, persistent identity)
--   - Holiday Guest: their session token (the strongest identity available
--     for a guest who only ever signs in with a shared accommodation code —
--     not airtight against someone deliberately re-signing-in, but the best
--     available without adding new friction to the guest login flow)
-- ============================================================================

create table if not exists ratings (
  id bigserial primary key,
  entity_type text not null check (entity_type in ('restaurant', 'service', 'attraction')),
  entity_id bigint not null,
  voter_key text not null,
  voter_type text not null check (voter_type in ('local_guest', 'holiday_guest')),
  stars int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, voter_key)
);

create index if not exists idx_ratings_entity on ratings (entity_type, entity_id);

create trigger set_ratings_updated_at
  before update on ratings
  for each row
  execute function set_updated_at();
