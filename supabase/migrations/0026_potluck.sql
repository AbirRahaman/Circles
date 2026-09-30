-- Potluck: a sign-up sheet for any event. Members add items they're
-- bringing, or post unclaimed items for someone else to pick up.

create table public.event_potluck (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 120),
  note        text,
  claimed_by  uuid references public.profiles (id),
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

create index potluck_by_event on public.event_potluck (event_id, created_at);

alter table public.event_potluck enable row level security;

create policy potluck_read   on public.event_potluck for select using (public.is_member(public.event_group(event_id)));
create policy potluck_insert on public.event_potluck for insert with check (public.is_member(public.event_group(event_id)) and created_by = auth.uid());
create policy potluck_update on public.event_potluck for update using (public.is_member(public.event_group(event_id)));
create policy potluck_delete on public.event_potluck for delete using (public.is_member(public.event_group(event_id)));
