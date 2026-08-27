-- Multi-entry doctors & vets (name/number/address) and a hospital address for
-- accommodations. Existing single doctor/vet numbers are migrated into the new
-- arrays so old listings keep their data.
alter table accommodations add column if not exists doctors         jsonb not null default '[]'::jsonb;
alter table accommodations add column if not exists vets            jsonb not null default '[]'::jsonb;
alter table accommodations add column if not exists hospital_address text  not null default '';

update accommodations
  set doctors = jsonb_build_array(jsonb_build_object('name', '', 'number', doctor_contact, 'address', ''))
  where coalesce(doctor_contact, '') <> '' and doctors = '[]'::jsonb;

update accommodations
  set vets = jsonb_build_array(jsonb_build_object('name', '', 'number', vet_contact, 'address', ''))
  where coalesce(vet_contact, '') <> '' and vets = '[]'::jsonb;
