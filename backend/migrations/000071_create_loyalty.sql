-- 000071_create_loyalty.sql
-- Digital stamp cards ("buy N, get 1 free"). A partner turns a card on and sets
-- the rule; the partner adds a stamp for a customer by mobile number and redeems
-- the reward when the card is full. Cards are keyed by (partner, customer mobile)
-- so they persist across a customer's logins and work for local residents and
-- holiday guests alike. Partner categories reuse the existing partner_type values
-- (restaurant/service/attraction/accommodation/estate_agency/estate_agent).

-- Per-partner configuration: one program per partner page.
create table if not exists loyalty_programs (
  id           bigserial primary key,
  partner_type text        not null,
  partner_id   bigint      not null,
  enabled      boolean     not null default false,
  threshold    int         not null default 10,
  reward_text  text        not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (partner_type, partner_id)
);

-- One card per (partner, customer mobile): current progress plus lifetime totals.
create table if not exists loyalty_cards (
  id             bigserial   primary key,
  partner_type   text        not null,
  partner_id     bigint      not null,
  customer_phone text        not null,
  stamps         int         not null default 0,
  total_stamps   int         not null default 0,
  rewards_earned int         not null default 0,
  last_stamp_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (partner_type, partner_id, customer_phone)
);

-- Audit log: one row per reward claimed.
create table if not exists loyalty_redemptions (
  id             bigserial   primary key,
  partner_type   text        not null,
  partner_id     bigint      not null,
  customer_phone text        not null,
  card_id        bigint      not null,
  threshold      int         not null,
  reward_text    text        not null default '',
  redeemed_by    text        not null default '',
  redeemed_at    timestamptz not null default now()
);

create index if not exists idx_loyalty_cards_partner on loyalty_cards (partner_type, partner_id);
create index if not exists idx_loyalty_cards_phone   on loyalty_cards (customer_phone);
create index if not exists idx_loyalty_redemptions_partner on loyalty_redemptions (partner_type, partner_id);
