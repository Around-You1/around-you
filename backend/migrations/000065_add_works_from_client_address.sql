-- Mobile partners (restaurants/services/attractions that travel to the client)
-- have no fixed address or coordinates. This flag keeps them in every radius /
-- nearby search regardless of missing coordinates. Default false.
alter table restaurants add column if not exists works_from_client_address boolean not null default false;
alter table services    add column if not exists works_from_client_address boolean not null default false;
alter table attractions add column if not exists works_from_client_address boolean not null default false;
