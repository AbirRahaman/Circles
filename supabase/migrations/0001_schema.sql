-- Circles — core schema
-- Mirrors the data model in the MVP spec. Soft deletes everywhere:
-- nothing a vote, RSVP or entry points at is ever hard-deleted.

create extension if not exists pgcrypto;

create type membership_role   as enum ('admin', 'member');
create type membership_status as enum ('invited', 'active', 'left');
create type event_status      as enum ('proposed', 'confirmed', 'cancelled');
create type vote_response     as enum ('yes', 'no', 'maybe');
create type rsvp_response     as enum ('going', 'not_going', 'maybe');
create type challenge_type    as enum ('distance', 'count', 'custom');
create type challenge_target  as enum ('per_person', 'group');

-- User ------------------------------------------------------------------
-- auth.users holds credentials and the auth provider; this is the public
-- profile every other table references.
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  name            text not null,
  email_or_phone  text,
  avatar_url      text,
  created_at      timestamptz not null default now()
);

-- Created automatically on signup, so a session always has a profile.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email_or_phone, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'friend'), '@', 1)),
    coalesce(new.email, new.phone),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- FriendGroup -----------------------------------------------------------
create table public.friend_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 60),
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

-- Membership ------------------------------------------------------------
create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id),
  group_id   uuid not null references public.friend_groups (id) on delete cascade,
  role       membership_role   not null default 'member',
  status     membership_status not null default 'invited',
  joined_at  timestamptz,
  left_at    timestamptz
);

-- A user holds at most one live membership per group; rejoining inserts a
-- NEW row while the old 'left' row stays for history.
create unique index memberships_one_live
  on public.memberships (group_id, user_id)
  where status <> 'left';

create index memberships_by_user  on public.memberships (user_id) where status = 'active';
create index memberships_by_group on public.memberships (group_id);

-- Invites ---------------------------------------------------------------
-- Token in a link, so nobody has to match phone numbers against accounts.
create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.friend_groups (id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  revoked_at  timestamptz
);
create index invites_by_group on public.invites (group_id);

-- Event -----------------------------------------------------------------
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.friend_groups (id) on delete cascade,
  created_by      uuid not null references public.profiles (id),
  title           text not null check (length(trim(title)) between 1 and 120),
  location        text,
  notes           text,
  status          event_status not null default 'proposed',
  confirmed_time  timestamptz,
  created_at      timestamptz not null default now(),
  constraint confirmed_needs_time check (status <> 'confirmed' or confirmed_time is not null)
);
create index events_by_group on public.events (group_id, confirmed_time);

create table public.event_time_options (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  proposed_time timestamptz not null,
  unique (event_id, proposed_time)
);

create table public.event_votes (
  id             uuid primary key default gen_random_uuid(),
  time_option_id uuid not null references public.event_time_options (id) on delete cascade,
  user_id        uuid not null references public.profiles (id),
  response       vote_response not null,
  updated_at     timestamptz not null default now(),
  unique (time_option_id, user_id)
);

create table public.event_rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id),
  response   rsvp_response not null,
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- SplitwiseLink ---------------------------------------------------------
-- Expenses are never copied here; balances are read live from Splitwise.
create table public.splitwise_links (
  id                  uuid primary key default gen_random_uuid(),
  group_id            uuid not null unique references public.friend_groups (id) on delete cascade,
  splitwise_group_id  text not null,
  splitwise_group_name text,
  linked_by           uuid not null references public.profiles (id),
  access_token        text not null,   -- encrypted app-side before insert
  created_at          timestamptz not null default now()
);

-- AlbumLink -------------------------------------------------------------
create table public.album_links (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.friend_groups (id) on delete cascade,
  event_id         uuid references public.events (id) on delete set null,
  icloud_share_url text not null,
  created_by       uuid not null references public.profiles (id),
  created_at       timestamptz not null default now(),
  reminder_sent_at timestamptz
);
create index album_links_by_group on public.album_links (group_id);
create index album_links_pending on public.album_links (event_id) where reminder_sent_at is null;

-- Challenge -------------------------------------------------------------
create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.friend_groups (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 120),
  type        challenge_type not null default 'custom',
  unit        text not null default 'points',
  target      numeric,
  target_mode challenge_target not null default 'per_person',
  start_date  date not null,
  end_date    date not null,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  constraint dates_in_order check (end_date >= start_date)
);
create index challenges_by_group on public.challenges (group_id, end_date);

create table public.challenge_entries (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id),
  amount       numeric not null check (amount > 0),
  note         text,
  logged_at    timestamptz not null default now()
);
create index entries_by_challenge on public.challenge_entries (challenge_id);

-- Leaderboard in one round trip.
create or replace view public.challenge_totals as
  select challenge_id, user_id, sum(amount) as total, count(*) as entries
  from public.challenge_entries
  group by challenge_id, user_id;
