-- Rename three rep codes to friendly names, consistently across every column
-- that stores a rep code so all references (partners, subscriptions, invoices,
-- commissions, rep hierarchy, applications) stay linked:
--   Rep00000001 -> ZERO       (internal/test + free rep)
--   Rep00000005 -> AROUNDYOU  (internal company account, no commission)
--   Rep00000012 -> HALF       (half-price + no-commission internal account)
-- Matching is case-insensitive on the old code; the new value is stored exactly.
-- The special-rep BEHAVIOUR for these codes is preserved in code
-- (appdb.reppolicy.go defaults updated to zero/aroundyou/half).

-- Reusable mapping applied to each column.
-- users: the rep's own code and its upline (team-leader) pointer
update users set rep_code = case lower(rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else rep_code end
  where lower(rep_code) in ('rep00000001','rep00000005','rep00000012');
update users set upline_rep_code = case lower(upline_rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else upline_rep_code end
  where lower(upline_rep_code) in ('rep00000001','rep00000005','rep00000012');

-- partner billing + accounting references
update partner_subscription set rep_code = case lower(rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else rep_code end
  where lower(rep_code) in ('rep00000001','rep00000005','rep00000012');
update invoice set bill_rep_code = case lower(bill_rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else bill_rep_code end
  where lower(bill_rep_code) in ('rep00000001','rep00000005','rep00000012');
update commission set rep_code = case lower(rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else rep_code end
  where lower(rep_code) in ('rep00000001','rep00000005','rep00000012');
update commission set source_rep_code = case lower(source_rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else source_rep_code end
  where lower(source_rep_code) in ('rep00000001','rep00000005','rep00000012');
update rep_invoice set rep_code = case lower(rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else rep_code end
  where lower(rep_code) in ('rep00000001','rep00000005','rep00000012');
update partner_applications set rep_code = case lower(rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else rep_code end
  where lower(rep_code) in ('rep00000001','rep00000005','rep00000012');

-- each partner table's onboarding rep
update restaurants    set official_rep_code = case lower(official_rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else official_rep_code end
  where lower(official_rep_code) in ('rep00000001','rep00000005','rep00000012');
update services       set official_rep_code = case lower(official_rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else official_rep_code end
  where lower(official_rep_code) in ('rep00000001','rep00000005','rep00000012');
update attractions    set official_rep_code = case lower(official_rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else official_rep_code end
  where lower(official_rep_code) in ('rep00000001','rep00000005','rep00000012');
update accommodations set official_rep_code = case lower(official_rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else official_rep_code end
  where lower(official_rep_code) in ('rep00000001','rep00000005','rep00000012');
update estate_agencies set official_rep_code = case lower(official_rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else official_rep_code end
  where lower(official_rep_code) in ('rep00000001','rep00000005','rep00000012');
update estate_agents  set official_rep_code = case lower(official_rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else official_rep_code end
  where lower(official_rep_code) in ('rep00000001','rep00000005','rep00000012');
update retail         set official_rep_code = case lower(official_rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else official_rep_code end
  where lower(official_rep_code) in ('rep00000001','rep00000005','rep00000012');
update nonprofits     set official_rep_code = case lower(official_rep_code)
  when 'rep00000001' then 'ZERO' when 'rep00000005' then 'AROUNDYOU' when 'rep00000012' then 'HALF' else official_rep_code end
  where lower(official_rep_code) in ('rep00000001','rep00000005','rep00000012');

