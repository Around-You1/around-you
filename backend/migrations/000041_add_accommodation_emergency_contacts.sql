-- 000041_add_accommodation_emergency_contacts.sql
-- Extra Emergency Numbers on accommodation profiles: Snake Catchers, NSRI, Vet,
-- Community Watch, Local Security. Nullable-safe with '' defaults, matching the
-- existing emergency contact columns.
alter table accommodations add column if not exists snake_catchers_contact  text not null default '';
alter table accommodations add column if not exists nsri_contact            text not null default '';
alter table accommodations add column if not exists vet_contact             text not null default '';
alter table accommodations add column if not exists community_watch_contact text not null default '';
alter table accommodations add column if not exists local_security_contact  text not null default '';
