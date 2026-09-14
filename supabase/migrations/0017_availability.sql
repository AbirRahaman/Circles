-- Finding a date, as opposed to voting on two someone already chose.
--
-- The proposer sets a window; everyone marks the days they CAN'T do. Marking
-- blockers rather than availability is far less tapping — people know the
-- three days they're away, not the twenty-seven they're free.
--
-- One row per person per event, with the blocked days as an array: a whole
-- response is one upsert, and rendering the grid is one pass over few rows.

alter table public.events
  add column if not exists window_start date,
  add column if not exists window_end   date;

alter table public.events
  add constraint window_in_order
  check (window_end is null or (window_start is not null and window_end >= window_start));

create table public.event_availability (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id),
  unavailable date[] not null default '{}',
  note        text,
  updated_at  timestamptz not null default now(),
  unique (event_id, user_id)
);
create index event_availability_by_event on public.event_availability (event_id);

alter table public.event_availability enable row level security;

-- Everyone sees the overlap; you only speak for yourself.
create policy availability_read   on public.event_availability for select using (public.is_member(public.event_group(event_id)));
create policy availability_insert on public.event_availability for insert with check (user_id = auth.uid() and public.is_member(public.event_group(event_id)));
create policy availability_update on public.event_availability for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy availability_delete on public.event_availability for delete using (user_id = auth.uid());
