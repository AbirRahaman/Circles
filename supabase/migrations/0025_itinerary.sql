-- An itinerary is the timeline for an event: a series of stops, activities,
-- or moments in order. Unlike trip_items (budgeting and logistics), the
-- itinerary answers "what are we doing, and when" for any event kind.

create table public.event_itinerary (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 120),
  starts_at   timestamptz,
  ends_at     timestamptz,
  location    text,
  notes       text,
  position    integer not null default 0,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  constraint itinerary_end_after_start
    check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index itinerary_by_event on public.event_itinerary (event_id, position, starts_at);

alter table public.event_itinerary enable row level security;

-- Same open model as trip items: any active group member can manage the
-- itinerary, since events are collaborative by nature.
create policy itinerary_read   on public.event_itinerary for select using (public.is_member(public.event_group(event_id)));
create policy itinerary_insert on public.event_itinerary for insert with check (public.is_member(public.event_group(event_id)) and created_by = auth.uid());
create policy itinerary_update on public.event_itinerary for update using (public.is_member(public.event_group(event_id)));
create policy itinerary_delete on public.event_itinerary for delete using (public.is_member(public.event_group(event_id)));
