-- Existing retail "My Stamp Card" promotions were created before each promotion
-- carried its own id, so they never got a stamp card and the partner's till
-- screen had nothing to stamp. Give every special a stable id, then create a
-- loyalty program per stampcard special so these promotions work immediately —
-- no manual re-save needed.

-- 1) Assign a stable id to any special that lacks one (array order preserved).
update retail r
set specials = sub.arr
from (
  select r2.id,
         jsonb_agg(
           case when coalesce(e.elem->>'id','') = ''
                then e.elem || jsonb_build_object('id', md5(r2.id::text || '-' || e.ord::text || '-' || clock_timestamp()::text))
                else e.elem end
           order by e.ord
         ) as arr
  from retail r2,
       lateral jsonb_array_elements(r2.specials) with ordinality as e(elem, ord)
  where jsonb_typeof(r2.specials) = 'array'
  group by r2.id
) sub
where r.id = sub.id
  and jsonb_typeof(r.specials) = 'array'
  and exists (
    select 1 from jsonb_array_elements(r.specials) x
    where coalesce(x->>'id','') = ''
  );

-- 2) Create/enable a loyalty program for each "My Stamp Card" special.
insert into loyalty_programs (partner_type, partner_id, special_id, enabled, threshold, reward_text, label)
select 'retail', r.id, e->>'id',
       coalesce((e->>'enabled')::boolean, true),
       greatest(coalesce(nullif(e->>'threshold','')::int, 10), 1),
       coalesce(e->>'line2', ''),
       coalesce(e->>'line1', '')
from retail r,
     lateral jsonb_array_elements(r.specials) e
where jsonb_typeof(r.specials) = 'array'
  and e->>'type' = 'stampcard'
  and coalesce(e->>'id', '') <> ''
on conflict (partner_type, partner_id, special_id) do update set
  enabled     = excluded.enabled,
  threshold   = excluded.threshold,
  reward_text = excluded.reward_text,
  label       = excluded.label,
  updated_at  = now();
