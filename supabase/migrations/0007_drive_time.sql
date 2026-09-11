-- A drive time is easier to know than an arrival time: "it's about 45
-- minutes" is something people say. Given a departure, the app can work
-- out the ETA; given neither, it can still answer "if we left now…".

alter table public.event_cars
  add column if not exists drive_minutes int
  check (drive_minutes is null or (drive_minutes > 0 and drive_minutes <= 2880));
