-- Additional payment methods across all partner tables.
do $$
declare t text;
begin
  foreach t in array array['restaurants','services','attractions','retail','nonprofits'] loop
    execute format('alter table %I add column if not exists payment_ikhokha    boolean not null default false', t);
    execute format('alter table %I add column if not exists payment_gpay       boolean not null default false', t);
    execute format('alter table %I add column if not exists payment_samsungpay boolean not null default false', t);
    execute format('alter table %I add column if not exists payment_sassa      boolean not null default false', t);
    execute format('alter table %I add column if not exists payment_applepay   boolean not null default false', t);
  end loop;
end $$;
