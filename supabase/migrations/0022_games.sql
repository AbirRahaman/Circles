-- 0022: Game mode. First game: Ride the Bus.
--
-- A game is an append-only event log. Clients fold the log with the same
-- TypeScript engine the server uses, so every device shows the same state
-- and a finished game can be replayed exactly.
--
-- Ordering is settled in Postgres, not by the clients: a trigger takes the
-- game row's lock, stamps the next seq and bumps the counter, so two people
-- tapping the same pyramid slot at the same moment get two ordered events
-- instead of a conflict.

create table if not exists public.games (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.friend_groups (id) on delete cascade,
  event_id    uuid references public.events (id) on delete set null,
  kind        text not null default 'ridethebus',
  status      text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  persona     text not null default 'asshole' check (persona in ('neutral', 'grudge', 'asshole')),
  stakes      text not null default 'drinks' check (stakes in ('drinks', 'points')),
  next_seq    int  not null default 0,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  finished_at timestamptz,
  deleted_at  timestamptz
);
create index if not exists games_by_group on public.games (group_id, created_at desc) where deleted_at is null;
create index if not exists games_by_event on public.games (event_id) where deleted_at is null;

create table if not exists public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  seat    int  not null,
  primary key (game_id, user_id)
);

create table if not exists public.game_events (
  game_id    uuid not null references public.games (id) on delete cascade,
  seq        int  not null,
  type       text not null,
  payload    jsonb not null,
  actor      uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (game_id, seq)
);

-- Final per-player numbers, written once when the game ends. The leaderboard
-- reads these instead of re-folding every log.
create table if not exists public.game_results (
  game_id      uuid not null references public.games (id) on delete cascade,
  user_id      uuid not null references public.profiles (id),
  correct      int not null default 0,
  given        int not null default 0,
  taken        int not null default 0,
  laid         int not null default 0,
  cards_left   int not null default 0,
  bus_runs     int not null default 0,
  longest_miss int not null default 0,
  rode_bus     boolean not null default false,
  primary key (game_id, user_id)
);

create or replace function public.game_group(g uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.games where id = g;
$$;

/** Stamps seq under the game row's lock and refuses writes to a game that
    is over. Security definer so the counter update isn't blocked by RLS. */
create or replace function public.game_event_seq()
returns trigger language plpgsql security definer set search_path = public as $$
declare g public.games%rowtype;
begin
  select * into g from public.games where id = new.game_id for update;
  if not found then raise exception 'game_missing'; end if;
  if g.status <> 'active' then raise exception 'game_over'; end if;
  new.seq := g.next_seq;
  update public.games set next_seq = g.next_seq + 1 where id = g.id;
  return new;
end $$;

drop trigger if exists game_event_seq on public.game_events;
create trigger game_event_seq before insert on public.game_events
  for each row execute function public.game_event_seq();

alter table public.games        enable row level security;
alter table public.game_players enable row level security;
alter table public.game_events  enable row level security;
alter table public.game_results enable row level security;

drop policy if exists games_read      on public.games;
drop policy if exists games_insert    on public.games;
drop policy if exists games_update    on public.games;
drop policy if exists gplayers_read   on public.game_players;
drop policy if exists gplayers_insert on public.game_players;
drop policy if exists gevents_read    on public.game_events;
drop policy if exists gevents_insert  on public.game_events;
drop policy if exists gresults_read   on public.game_results;
drop policy if exists gresults_insert on public.game_results;

create policy games_read   on public.games for select using (public.is_member(group_id));
create policy games_insert on public.games for insert with check (public.is_member(group_id) and created_by = auth.uid());
create policy games_update on public.games for update using (public.is_member(group_id)) with check (public.is_member(group_id));

create policy gplayers_read   on public.game_players for select using (public.is_member(public.game_group(game_id)));
create policy gplayers_insert on public.game_players for insert with check (public.is_member(public.game_group(game_id)));

-- Append-only: no update or delete policy exists, so the log can't be rewritten.
create policy gevents_read   on public.game_events for select using (public.is_member(public.game_group(game_id)));
create policy gevents_insert on public.game_events for insert
  with check (public.is_member(public.game_group(game_id)) and actor = auth.uid());

create policy gresults_read   on public.game_results for select using (public.is_member(public.game_group(game_id)));
create policy gresults_insert on public.game_results for insert with check (public.is_member(public.game_group(game_id)));

-- Realtime: every player's phone subscribes to this table for their game.
do $$ begin
  alter publication supabase_realtime add table public.game_events;
exception when duplicate_object then null; end $$;
