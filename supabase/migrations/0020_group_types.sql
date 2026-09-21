-- 0020: Group types (friends / professional / roommates) plus the three
-- roommate tools: grocery list, meal plan, chore rotation.
-- Existing groups become 'friends', so nothing changes for them.

do $$ begin
  create type public.group_type as enum ('friends', 'professional', 'roommates');
exception when duplicate_object then null; end $$;

alter table public.friend_groups
  add column if not exists type public.group_type not null default 'friends';

-- create_group gains a type. Drop the one-argument version first so calls
-- aren't ambiguous between the two signatures.
drop function if exists public.create_group(text);
create or replace function public.create_group(p_name text, p_type public.group_type default 'friends')
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into friend_groups (name, created_by, type) values (p_name, auth.uid(), p_type) returning id into g;
  insert into memberships (user_id, group_id, role, status, joined_at)
  values (auth.uid(), g, 'admin', 'active', now());
  insert into invites (group_id, created_by) values (g, auth.uid());
  return g;
end $$;

-- Behavior ratings are a friend-group feature; refuse writes in other types.
create or replace function public.can_set_behavior(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.friend_groups g
           where g.id = public.event_group(e) and g.behavior_enabled and g.type = 'friends'
         )
     and (
           exists (select 1 from public.events ev where ev.id = e and ev.created_by = auth.uid())
        or exists (select 1 from public.event_cohosts c where c.event_id = e and c.user_id = auth.uid())
        or public.is_group_admin(public.event_group(e))
     );
$$;

-- ── Grocery list ───────────────────────────────────────────────────────
create table if not exists public.grocery_items (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.friend_groups (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 80),
  qty        text check (qty is null or length(qty) <= 30),
  added_by   uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  checked_by uuid references public.profiles (id),
  checked_at timestamptz,
  deleted_at timestamptz
);
create index if not exists grocery_by_group on public.grocery_items (group_id, created_at) where deleted_at is null;

-- ── Meal plan ──────────────────────────────────────────────────────────
create table if not exists public.meal_plans (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.friend_groups (id) on delete cascade,
  day        date not null,
  slot       text not null default 'dinner' check (slot in ('breakfast', 'lunch', 'dinner')),
  title      text not null check (length(trim(title)) between 1 and 80),
  cook_id    uuid references public.profiles (id),
  note       text check (note is null or length(note) <= 200),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists meals_by_group_day on public.meal_plans (group_id, day) where deleted_at is null;

-- ── Chore rotation ─────────────────────────────────────────────────────
-- rotation is the ordered list of people taking turns. The assignee for a
-- week is rotation[(weeks since start_week) mod length], computed in the app.
create table if not exists public.chores (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.friend_groups (id) on delete cascade,
  title      text not null check (length(trim(title)) between 1 and 60),
  rotation   uuid[] not null check (cardinality(rotation) >= 1),
  start_week date not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists chores_by_group on public.chores (group_id) where deleted_at is null;

create table if not exists public.chore_completions (
  id         uuid primary key default gen_random_uuid(),
  chore_id   uuid not null references public.chores (id) on delete cascade,
  week_start date not null,
  done_by    uuid not null references public.profiles (id),
  done_at    timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists chore_done_once
  on public.chore_completions (chore_id, week_start) where deleted_at is null;

create or replace function public.chore_group(c uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.chores where id = c;
$$;

alter table public.grocery_items     enable row level security;
alter table public.meal_plans        enable row level security;
alter table public.chores            enable row level security;
alter table public.chore_completions enable row level security;

-- Everything here is shared housekeeping: any member can add, edit and
-- soft-delete (set deleted_at). No hard deletes.
drop policy if exists grocery_read   on public.grocery_items;
drop policy if exists grocery_insert on public.grocery_items;
drop policy if exists grocery_update on public.grocery_items;
create policy grocery_read   on public.grocery_items for select using (public.is_member(group_id));
create policy grocery_insert on public.grocery_items for insert with check (public.is_member(group_id) and added_by = auth.uid());
create policy grocery_update on public.grocery_items for update using (public.is_member(group_id)) with check (public.is_member(group_id));

drop policy if exists meals_read   on public.meal_plans;
drop policy if exists meals_insert on public.meal_plans;
drop policy if exists meals_update on public.meal_plans;
create policy meals_read   on public.meal_plans for select using (public.is_member(group_id));
create policy meals_insert on public.meal_plans for insert with check (public.is_member(group_id) and created_by = auth.uid());
create policy meals_update on public.meal_plans for update using (public.is_member(group_id)) with check (public.is_member(group_id));

drop policy if exists chores_read   on public.chores;
drop policy if exists chores_insert on public.chores;
drop policy if exists chores_update on public.chores;
create policy chores_read   on public.chores for select using (public.is_member(group_id));
create policy chores_insert on public.chores for insert with check (public.is_member(group_id) and created_by = auth.uid());
create policy chores_update on public.chores for update using (public.is_member(group_id)) with check (public.is_member(group_id));

drop policy if exists chore_done_read   on public.chore_completions;
drop policy if exists chore_done_insert on public.chore_completions;
drop policy if exists chore_done_update on public.chore_completions;
create policy chore_done_read   on public.chore_completions for select using (public.is_member(public.chore_group(chore_id)));
create policy chore_done_insert on public.chore_completions for insert with check (public.is_member(public.chore_group(chore_id)) and done_by = auth.uid());
create policy chore_done_update on public.chore_completions for update using (public.is_member(public.chore_group(chore_id)));
