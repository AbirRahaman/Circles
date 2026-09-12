-- Per-event conduct rating. The event's creator holds the pen and can hand
-- it to co-hosts; a group admin can always step in so a rating can't get
-- stuck when the creator has moved on.

create table public.event_cohosts (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id),
  added_by   uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index event_cohosts_by_event on public.event_cohosts (event_id);

create table public.event_behavior (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id),
  level      int  not null check (level between 1 and 11),
  note       text,
  set_by     uuid not null references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index event_behavior_by_event on public.event_behavior (event_id);

create or replace function public.can_set_behavior(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events ev where ev.id = e and ev.created_by = auth.uid())
      or exists (select 1 from public.event_cohosts c where c.event_id = e and c.user_id = auth.uid())
      or public.is_group_admin(public.event_group(e));
$$;

/** Only the person who made the event (or a group admin) hands out the pen —
    co-hosts can rate, but they cannot appoint further co-hosts. */
create or replace function public.owns_event(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events ev where ev.id = e and ev.created_by = auth.uid())
      or public.is_group_admin(public.event_group(e));
$$;

alter table public.event_cohosts  enable row level security;
alter table public.event_behavior enable row level security;

create policy cohosts_read   on public.event_cohosts for select using (public.is_member(public.event_group(event_id)));
create policy cohosts_insert on public.event_cohosts for insert with check (public.owns_event(event_id) and added_by = auth.uid());
create policy cohosts_delete on public.event_cohosts for delete using (public.owns_event(event_id));

create policy behavior_read   on public.event_behavior for select using (public.is_member(public.event_group(event_id)));
create policy behavior_insert on public.event_behavior for insert with check (public.can_set_behavior(event_id) and set_by = auth.uid());
create policy behavior_update on public.event_behavior for update using (public.can_set_behavior(event_id));
create policy behavior_delete on public.event_behavior for delete using (public.can_set_behavior(event_id));
