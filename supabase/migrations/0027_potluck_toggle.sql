-- Potluck is now opt-in per event rather than always showing.
alter table public.events
  add column potluck_enabled boolean not null default false;

-- Backfill: any event that already has potluck items gets the flag set.
update public.events
  set potluck_enabled = true
  where id in (select distinct event_id from public.event_potluck);
