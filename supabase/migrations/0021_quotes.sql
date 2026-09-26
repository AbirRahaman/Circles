-- 0021: Quote of the day, shown on the Check-in tab.
-- Anyone in the group can post one or more for a day. for_date is the
-- group-timezone day, supplied by the app (same reasoning as checkins).

create table if not exists public.group_quotes (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.friend_groups (id) on delete cascade,
  for_date   date not null,
  text       text not null check (length(trim(text)) between 1 and 280),
  said_by    text check (said_by is null or length(said_by) <= 60),
  added_by   uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists quotes_by_group_date
  on public.group_quotes (group_id, for_date desc) where deleted_at is null;

alter table public.group_quotes enable row level security;

drop policy if exists quotes_read   on public.group_quotes;
drop policy if exists quotes_insert on public.group_quotes;
drop policy if exists quotes_update on public.group_quotes;

create policy quotes_read on public.group_quotes for select
  using (public.is_member(group_id));
create policy quotes_insert on public.group_quotes for insert
  with check (public.is_member(group_id) and added_by = auth.uid());
-- Soft delete only: whoever posted it, or a group admin.
create policy quotes_update on public.group_quotes for update
  using (added_by = auth.uid() or public.is_group_admin(group_id));
