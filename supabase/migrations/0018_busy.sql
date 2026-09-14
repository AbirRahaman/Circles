-- Free/busy across groups, as a first pass before anyone answers.
--
-- The app can't query this directly: RLS stops you reading events in groups
-- you don't belong to, and rightly so. This function is the narrow exception
-- — it returns DAYS ONLY. No titles, no locations, no group names, nothing
-- that says which group someone is busy with. Just "that person has
-- something on".
--
-- Two guards: the person must have left sharing on, and you must already
-- share an active group with them.

alter table public.profiles
  add column if not exists share_busy boolean not null default true;

create or replace function public.busy_days(
  p_users uuid[],
  p_from  date,
  p_to    date,
  p_tz    text default 'America/New_York'
)
returns table (user_id uuid, day date)
language sql stable security definer set search_path = public as $$
  select distinct m.user_id, d::date as day
  from public.memberships m
  join public.profiles p
    on p.id = m.user_id and p.share_busy
  join public.events e
    on e.group_id = m.group_id
   and e.status = 'confirmed'
   and e.confirmed_time is not null
  cross join lateral generate_series(
    (e.confirmed_time at time zone p_tz)::date,
    (coalesce(e.ends_at, e.confirmed_time) at time zone p_tz)::date,
    interval '1 day'
  ) as d
  where m.user_id = any(p_users)
    and m.status = 'active'
    and d::date between p_from and p_to
    -- you may only ask about people you already share a group with
    and exists (
      select 1
      from public.memberships mine
      join public.memberships theirs
        on theirs.group_id = mine.group_id
       and theirs.user_id = m.user_id
       and theirs.status = 'active'
      where mine.user_id = auth.uid() and mine.status = 'active'
    );
$$;

revoke all on function public.busy_days(uuid[], date, date, text) from public;
grant execute on function public.busy_days(uuid[], date, date, text) to authenticated;
