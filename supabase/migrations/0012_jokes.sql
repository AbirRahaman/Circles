-- The bit of a trip you actually want back later. Scoped to the event so a
-- joke stays attached to the night it came from; a group-wide view is just
-- a query away if you ever want one.

create table public.event_jokes (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id),
  text       text not null check (length(trim(text)) between 1 and 280),
  created_at timestamptz not null default now()
);
create index event_jokes_by_event on public.event_jokes (event_id, created_at);

alter table public.event_jokes enable row level security;

-- Everyone in the group reads them; you add your own and can take back
-- your own. Nobody deletes someone else's — that is the whole point of a
-- shared record.
create policy jokes_read   on public.event_jokes for select using (public.is_member(public.event_group(event_id)));
create policy jokes_insert on public.event_jokes for insert with check (user_id = auth.uid() and public.is_member(public.event_group(event_id)));
create policy jokes_delete on public.event_jokes for delete using (user_id = auth.uid());
