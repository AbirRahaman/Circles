-- A trip is an event with a longer horizon and a plan attached, not a
-- separate species. Making it a `kind` means trips inherit RSVPs, carpools,
-- albums, jokes, tallies and behavior for free — all of which are already
-- keyed to event_id.

create type event_kind as enum ('outing', 'trip');

alter table public.events
  add column if not exists kind event_kind not null default 'outing',
  add column if not exists budget_per_person numeric check (budget_per_person is null or budget_per_person >= 0);

create type trip_item_kind   as enum ('housing', 'transport', 'activity', 'food', 'other');
create type trip_item_status as enum ('idea', 'booked');

create table public.trip_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  kind        trip_item_kind   not null default 'other',
  status      trip_item_status not null default 'idea',
  title       text not null check (length(trim(title)) between 1 and 120),
  detail      text,
  url         text,
  starts_at   timestamptz,
  cost        numeric check (cost is null or cost >= 0),
  -- whether `cost` is what each person pays, or the whole thing split later
  per_person  boolean not null default false,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index trip_items_by_event on public.trip_items (event_id, kind, starts_at);

alter table public.trip_items enable row level security;

-- Planning a trip is a group activity: any active member adds, edits and
-- removes items. Events themselves are already member-editable.
create policy trip_items_read   on public.trip_items for select using (public.is_member(public.event_group(event_id)));
create policy trip_items_insert on public.trip_items for insert with check (public.is_member(public.event_group(event_id)) and created_by = auth.uid());
create policy trip_items_update on public.trip_items for update using (public.is_member(public.event_group(event_id)));
create policy trip_items_delete on public.trip_items for delete using (public.is_member(public.event_group(event_id)));
