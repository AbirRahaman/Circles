-- A daily check-in, group-scoped.
--
-- for_date is the calendar day in the group's timezone, supplied by the app
-- rather than derived from created_at — otherwise "today" drifts for anyone
-- checking in late at night, and the one-per-day rule can't be an index.
--
-- Visibility is per check-in, not per person: some days you want your friends
-- to see it, some days you just want to log it.

create table public.checkins (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.friend_groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id),
  for_date   date not null,
  level      int  not null check (level between 1 and 5),
  note       text check (note is null or length(note) <= 280),
  visibility text not null default 'group' check (visibility in ('group', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id, for_date)
);
create index checkins_by_group_date on public.checkins (group_id, for_date desc);

alter table public.checkins enable row level security;

-- Your own always; other people's only when they chose to share them.
create policy checkins_read on public.checkins for select using (
  user_id = auth.uid()
  or (visibility = 'group' and public.is_member(group_id))
);
create policy checkins_insert on public.checkins for insert
  with check (user_id = auth.uid() and public.is_member(group_id));
create policy checkins_update on public.checkins for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy checkins_delete on public.checkins for delete using (user_id = auth.uid());
