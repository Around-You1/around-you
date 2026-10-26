-- Show the promotion's product image on its stamp card (partner till screen and
-- the customer's My Stamp Cards). Store the image on the loyalty program and
-- backfill it from the matching retail "special".
alter table loyalty_programs add column if not exists image_url text not null default '';

update loyalty_programs lp
set image_url = coalesce(e->>'imageUrl', '')
from retail r,
     lateral jsonb_array_elements(r.specials) e
where lp.partner_type = 'retail'
  and lp.partner_id = r.id
  and e->>'id' = lp.special_id
  and coalesce(e->>'imageUrl', '') <> '';
