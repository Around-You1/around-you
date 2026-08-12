-- 000025_add_rep_hierarchy.sql
-- Phase 1 of Rep Commissions & Billing (see REP_BILLING_COMMISSIONS_SPEC.md).
-- Reps are users with role='Rep'. A rep has at most one upline (their Team
-- Leader), so the hierarchy + rep profile fields live directly on `users`
-- rather than in a separate table.
--
-- RLS: `users` already has RLS enabled/forced by migration 000024, and all
-- access is via the Go API (the postgres role bypasses RLS), so no RLS change
-- is needed here.

alter table users
  add column if not exists upline_rep_code text,
  add column if not exists is_team_leader  boolean     not null default false,
  add column if not exists region          text,
  add column if not exists province        text,
  add column if not exists rep_status      text        not null default 'Active',
  add column if not exists date_joined     timestamptz not null default now();

-- Constrain rep_status to known values (drop/recreate = idempotent, matching
-- the pattern used for users_role_check in 000008 / 000022).
alter table users drop constraint if exists users_rep_status_check;
alter table users add constraint users_rep_status_check
  check (rep_status in ('Active', 'Inactive'));

-- Fast lookup of a Team Leader's direct downline.
create index if not exists idx_users_upline_rep_code on users (upline_rep_code);
