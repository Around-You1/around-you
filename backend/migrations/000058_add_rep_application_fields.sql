-- Persist the remaining Rep Application fields so a rep's monthly invoice can be
-- generated and sent automatically (with full banking + tax details) without
-- the rep re-entering anything. ID, phone, residential address, province and
-- postal code are already stored (migrations 000053–000056); these are the rest.
-- Existing reps get '' until captured (their banking/tax can be filled in on the
-- Admin Reps tab, or re-submitted).
alter table users add column if not exists date_of_birth       text not null default '';
alter table users add column if not exists tax_number          text not null default '';
alter table users add column if not exists vat_number          text not null default '';
alter table users add column if not exists bank_account_name   text not null default '';
alter table users add column if not exists bank_name           text not null default '';
alter table users add column if not exists bank_account_number text not null default '';
alter table users add column if not exists bank_branch_code    text not null default '';
alter table users add column if not exists bank_account_type   text not null default '';
