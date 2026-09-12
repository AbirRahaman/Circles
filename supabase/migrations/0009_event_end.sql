-- Plenty of plans last longer than a moment: a cabin weekend, a festival,
-- someone visiting for a week. Without an end, an event counts as past the
-- instant it starts.

alter table public.events
  add column if not exists ends_at timestamptz;

alter table public.events
  add constraint ends_after_start
  check (ends_at is null or (confirmed_time is not null and ends_at > confirmed_time));
