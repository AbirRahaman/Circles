-- A running tally for the night. One row per shot rather than a counter
-- column: counters built from read-modify-write lose taps when several
-- people tap at once, and a row each also makes "undo the last one"
-- trivial and gives the night a timeline.

create table public.event_party (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references public.events (id) on delete cascade,
  user_id   uuid not null references public.profiles (id),
  joined_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index event_party_by_event on public.event_party (event_id);

create table public.party_shots (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references public.events (id) on delete cascade,
  user_id   uuid not null references public.profiles (id),
  logged_at timestamptz not null default now()
);
create index party_shots_by_event on public.party_shots (event_id, user_id);

alter table public.event_party enable row level security;
alter table public.party_shots enable row level security;

-- Everyone in the group sees the tally; you only speak for yourself.
create policy party_read   on public.event_party for select using (public.is_member(public.event_group(event_id)));
create policy party_insert on public.event_party for insert with check (user_id = auth.uid() and public.is_member(public.event_group(event_id)));
create policy party_delete on public.event_party for delete using (user_id = auth.uid());

create policy shots_read   on public.party_shots for select using (public.is_member(public.event_group(event_id)));
create policy shots_insert on public.party_shots for insert with check (user_id = auth.uid() and public.is_member(public.event_group(event_id)));
create policy shots_delete on public.party_shots for delete using (user_id = auth.uid());
