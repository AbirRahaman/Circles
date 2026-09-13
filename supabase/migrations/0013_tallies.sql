-- Generic per-event counters. A tally is whatever its creator types; the
-- schema carries no presets, no defaults and no status vocabulary of its own.
--
-- One row per log rather than a counter column: concurrent taps can't
-- collide, undo is deleting the most recent row, and the timeline survives.

create table public.event_tallies (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  title      text not null check (length(trim(title)) between 1 and 60),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index event_tallies_by_event on public.event_tallies (event_id, created_at);

create table public.tally_entries (
  id        uuid primary key default gen_random_uuid(),
  tally_id  uuid not null references public.event_tallies (id) on delete cascade,
  user_id   uuid not null references public.profiles (id),
  amount    numeric not null default 1 check (amount > 0),
  logged_at timestamptz not null default now()
);
create index tally_entries_by_tally on public.tally_entries (tally_id, user_id);

-- Optional per-user state. Sitting out greys someone without touching what
-- they already logged; a null opted_out_at means they're taking part.
create table public.tally_participants (
  id           uuid primary key default gen_random_uuid(),
  tally_id     uuid not null references public.event_tallies (id) on delete cascade,
  user_id      uuid not null references public.profiles (id),
  opted_out_at timestamptz,
  unique (tally_id, user_id)
);

create or replace function public.tally_group(t uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.group_id
  from public.event_tallies et
  join public.events e on e.id = et.event_id
  where et.id = t;
$$;

alter table public.event_tallies      enable row level security;
alter table public.tally_entries      enable row level security;
alter table public.tally_participants enable row level security;

-- Any member starts a tally; its creator, or whoever owns the event, clears it.
create policy tallies_read   on public.event_tallies for select using (public.is_member(public.event_group(event_id)));
create policy tallies_insert on public.event_tallies for insert with check (public.is_member(public.event_group(event_id)) and created_by = auth.uid());
create policy tallies_delete on public.event_tallies for delete using (created_by = auth.uid() or public.owns_event(event_id));

-- You log for yourself and can take back your own rows.
create policy tally_entries_read   on public.tally_entries for select using (public.is_member(public.tally_group(tally_id)));
create policy tally_entries_insert on public.tally_entries for insert with check (user_id = auth.uid() and public.is_member(public.tally_group(tally_id)));
create policy tally_entries_delete on public.tally_entries for delete using (user_id = auth.uid());

-- Your own participation state, nobody else's.
create policy tally_pax_read   on public.tally_participants for select using (public.is_member(public.tally_group(tally_id)));
create policy tally_pax_insert on public.tally_participants for insert with check (user_id = auth.uid() and public.is_member(public.tally_group(tally_id)));
create policy tally_pax_update on public.tally_participants for update using (user_id = auth.uid()) with check (user_id = auth.uid());
