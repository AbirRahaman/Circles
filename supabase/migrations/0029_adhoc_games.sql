-- 0029: Ad-hoc games — no group, no account, cookie-identified players.
--
-- Parallel tables to the group game system. The pure TypeScript game
-- engines (ridethebus.ts, screwyourneighbor.ts) fold the same event types
-- and work unchanged — only the persistence and identity layers differ.

create table if not exists public.adhoc_games (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  kind        text not null default 'ridethebus'
              check (kind in ('ridethebus', 'screwyourneighbor')),
  status      text not null default 'lobby'
              check (status in ('lobby', 'active', 'finished', 'abandoned')),
  persona     text not null default 'asshole'
              check (persona in ('neutral', 'grudge', 'asshole')),
  stakes      text not null default 'drinks'
              check (stakes in ('drinks', 'points')),
  mode        text not null default 'single',
  host_token  text not null,
  next_seq    int  not null default 0,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.adhoc_players (
  game_id     uuid not null references public.adhoc_games (id) on delete cascade,
  guest_token text not null,
  name        text not null,
  seat        int,
  joined_at   timestamptz not null default now(),
  primary key (game_id, guest_token)
);

create table if not exists public.adhoc_events (
  game_id    uuid not null references public.adhoc_games (id) on delete cascade,
  seq        int  not null,
  type       text not null,
  payload    jsonb not null,
  actor      text not null,
  created_at timestamptz not null default now(),
  primary key (game_id, seq)
);

-- Sequence trigger (same pattern as group games)
create or replace function public.adhoc_event_seq()
returns trigger language plpgsql security definer set search_path = public as $$
declare g public.adhoc_games%rowtype;
begin
  select * into g from public.adhoc_games where id = new.game_id for update;
  if not found then raise exception 'game_missing'; end if;
  if g.status <> 'active' then raise exception 'game_over'; end if;
  new.seq := g.next_seq;
  update public.adhoc_games set next_seq = g.next_seq + 1 where id = g.id;
  return new;
end $$;

drop trigger if exists adhoc_event_seq on public.adhoc_events;
create trigger adhoc_event_seq before insert on public.adhoc_events
  for each row execute function public.adhoc_event_seq();

-- RLS: public read/write (server actions validate via guest cookie)
alter table public.adhoc_games   enable row level security;
alter table public.adhoc_players enable row level security;
alter table public.adhoc_events  enable row level security;

create policy adhoc_games_all   on public.adhoc_games   for all using (true) with check (true);
create policy adhoc_players_all on public.adhoc_players  for all using (true) with check (true);
create policy adhoc_events_all  on public.adhoc_events   for all using (true) with check (true);

-- Realtime for live game updates
do $$ begin
  alter publication supabase_realtime add table public.adhoc_events;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.adhoc_players;
exception when duplicate_object then null; end $$;

-- Security definer to load a game by token (no auth needed)
create or replace function public.get_adhoc_game(game_token text)
returns json language plpgsql security definer set search_path = public as $$
declare
  g public.adhoc_games%rowtype;
  result json;
begin
  select * into g from public.adhoc_games where token = game_token;
  if not found then return null; end if;

  select json_build_object(
    'id', g.id,
    'token', g.token,
    'kind', g.kind,
    'status', g.status,
    'persona', g.persona,
    'stakes', g.stakes,
    'mode', g.mode,
    'host_token', g.host_token,
    'players', (
      select coalesce(json_agg(json_build_object(
        'guest_token', p.guest_token,
        'name', p.name,
        'seat', p.seat
      ) order by p.joined_at), '[]'::json)
      from public.adhoc_players p where p.game_id = g.id
    ),
    'events', (
      select coalesce(json_agg(json_build_object(
        'seq', e.seq,
        'payload', e.payload
      ) order by e.seq), '[]'::json)
      from public.adhoc_events e where e.game_id = g.id
    )
  ) into result;

  return result;
end $$;
