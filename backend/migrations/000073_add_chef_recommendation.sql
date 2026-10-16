-- Restaurant "Chef Recommendation" free-text detail. When a restaurant ticks the
-- "Chef Recommendation" dietary option during onboarding, the actual
-- recommendation is captured here and shown as its own dropdown on the
-- Guest / Local / Partner views. Existing rows default to empty.
alter table restaurants add column if not exists chef_recommendation text not null default '';
