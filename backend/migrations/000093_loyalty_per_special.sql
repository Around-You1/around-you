-- "Separate stamp card per promotion": a retail partner can run several My Stamp
-- Card promotions, each its own card. We key loyalty programs and cards by an
-- extra special_id (the id of the retail "specials" entry). Legacy single cards
-- keep special_id = '' and keep working unchanged.
alter table loyalty_programs add column if not exists special_id text not null default '';
alter table loyalty_programs add column if not exists label      text not null default '';
alter table loyalty_cards       add column if not exists special_id text not null default '';
alter table loyalty_redemptions add column if not exists special_id text not null default '';

-- Widen the uniqueness to include special_id so each promotion has its own
-- program row and its own per-customer card.
alter table loyalty_programs drop constraint if exists loyalty_programs_partner_type_partner_id_key;
alter table loyalty_programs drop constraint if exists loyalty_programs_partner_special_key;
alter table loyalty_programs add constraint loyalty_programs_partner_special_key
  unique (partner_type, partner_id, special_id);

alter table loyalty_cards drop constraint if exists loyalty_cards_partner_type_partner_id_customer_phone_key;
alter table loyalty_cards drop constraint if exists loyalty_cards_partner_special_phone_key;
alter table loyalty_cards add constraint loyalty_cards_partner_special_phone_key
  unique (partner_type, partner_id, special_id, customer_phone);

create index if not exists idx_loyalty_cards_partner_special
  on loyalty_cards (partner_type, partner_id, special_id);
