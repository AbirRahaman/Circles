-- Guest invite links: let group members share a public event link
-- so non-members can view the event and RSVP without an account.

create table event_invite_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(event_id)  -- one link per event
);

create table event_guest_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  contact text,
  status text not null check (status in ('going', 'maybe', 'declined')),
  guest_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, guest_token)
);

-- RLS
alter table event_invite_links enable row level security;
alter table event_guest_rsvps enable row level security;

-- Members can manage invite links for their group's events
create policy "Members can view invite links"
  on event_invite_links for select
  using (exists (
    select 1 from events e
    join memberships m on m.group_id = e.group_id
    where e.id = event_invite_links.event_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  ));

create policy "Members can create invite links"
  on event_invite_links for insert
  with check (exists (
    select 1 from events e
    join memberships m on m.group_id = e.group_id
    where e.id = event_invite_links.event_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  ));

create policy "Members can update invite links"
  on event_invite_links for update
  using (exists (
    select 1 from events e
    join memberships m on m.group_id = e.group_id
    where e.id = event_invite_links.event_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  ));

-- Guest RSVPs are publicly readable (guest list on public page)
create policy "Anyone can view guest RSVPs"
  on event_guest_rsvps for select
  using (true);

-- Anyone can insert a guest RSVP (public page)
create policy "Anyone can RSVP as guest"
  on event_guest_rsvps for insert
  with check (true);

-- Guests can update their own RSVP (matched by guest_token in app logic)
create policy "Anyone can update guest RSVPs"
  on event_guest_rsvps for update
  using (true);

-- Security definer function for the public page.
-- The token is the access control — no auth required.
create or replace function get_event_by_invite_token(invite_token text)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  select json_build_object(
    'event', json_build_object(
      'id', e.id,
      'title', e.title,
      'status', e.status,
      'confirmed_time', e.confirmed_time,
      'ends_at', e.ends_at,
      'location', e.location,
      'notes', e.notes
    ),
    'invite_link', json_build_object(
      'id', il.id,
      'event_id', il.event_id,
      'active', il.active
    ),
    'host_name', p.name,
    'member_rsvps', coalesce((
      select json_agg(json_build_object(
        'name', mp.name,
        'status', er.response
      ))
      from event_rsvps er
      join profiles mp on mp.id = er.user_id
      where er.event_id = e.id
    ), '[]'::json),
    'guest_rsvps', coalesce((
      select json_agg(json_build_object(
        'id', gr.id,
        'name', gr.name,
        'status', gr.status,
        'guest_token', gr.guest_token
      ))
      from event_guest_rsvps gr
      where gr.event_id = e.id
    ), '[]'::json)
  ) into result
  from event_invite_links il
  join events e on e.id = il.event_id
  join profiles p on p.id = il.created_by
  where il.token = invite_token
    and il.active = true;

  return result;
end;
$$;
