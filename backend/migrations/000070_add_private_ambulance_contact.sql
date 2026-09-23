-- Split the accommodation Ambulance emergency number into Public (existing
-- ambulance_contact, relabelled in the UI) and a new Private Ambulance number.
alter table accommodations add column if not exists private_ambulance_contact text;
