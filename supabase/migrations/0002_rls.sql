-- Circles — row-level security
-- Section 3 of the spec, enforced in the database rather than in route
-- handlers: every group-scoped write first proves active membership, and
-- the admin-gated ones additionally prove role = 'admin'.

-- security definer so policies on memberships don't recurse into themselves
create or replace function public.is_member(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = g and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.is_group_admin(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = g and m.user_id = auth.uid()
      and m.status = 'active' and m.role = 'admin'
  );
$$;

create or replace function public.event_group(e uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.events where id = e;
$$;

create or replace function public.option_group(o uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.group_id from public.event_time_options t
  join public.events e on e.id = t.event_id where t.id = o;
$$;

create or replace function public.challenge_group(c uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.challenges where id = c;
$$;

alter table public.profiles           enable row level security;
alter table public.friend_groups      enable row level security;
alter table public.memberships        enable row level security;
alter table public.invites            enable row level security;
alter table public.events             enable row level security;
alter table public.event_time_options enable row level security;
alter table public.event_votes        enable row level security;
alter table public.event_rsvps        enable row level security;
alter table public.splitwise_links    enable row level security;
alter table public.album_links        enable row level security;
alter table public.challenges         enable row level security;
alter table public.challenge_entries  enable row level security;

-- Profiles: yourself, plus anyone you share an active group with.
create policy profiles_read on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.memberships mine
    join public.memberships theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and mine.status = 'active'
      and theirs.user_id = profiles.id and theirs.status = 'active'
  )
);
create policy profiles_write on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Groups: members read; admins rename; anyone signed in creates one.
create policy groups_read   on public.friend_groups for select using (public.is_member(id));
create policy groups_insert on public.friend_groups for insert with check (created_by = auth.uid());
create policy groups_update on public.friend_groups for update using (public.is_group_admin(id));
create policy groups_delete on public.friend_groups for delete using (public.is_group_admin(id));

-- Memberships: members see the roster. Writes go through the functions in
-- 0003 (join, leave, remove, promote) so history rules can't be bypassed.
create policy memberships_read on public.memberships for select using (public.is_member(group_id));

-- Invites: members read and create them (spec: anyone may invite);
-- admins revoke.
create policy invites_read   on public.invites for select using (public.is_member(group_id));
create policy invites_insert on public.invites for insert with check (public.is_member(group_id) and created_by = auth.uid());
create policy invites_update on public.invites for update using (public.is_group_admin(group_id));

-- Events: any active member creates, edits and cancels.
create policy events_read   on public.events for select using (public.is_member(group_id));
create policy events_insert on public.events for insert with check (public.is_member(group_id) and created_by = auth.uid());
create policy events_update on public.events for update using (public.is_member(group_id));

create policy options_read   on public.event_time_options for select using (public.is_member(public.event_group(event_id)));
create policy options_insert on public.event_time_options for insert with check (public.is_member(public.event_group(event_id)));
create policy options_delete on public.event_time_options for delete using (public.is_member(public.event_group(event_id)));

-- Votes and RSVPs: you read the group's, you write only your own.
create policy votes_read   on public.event_votes for select using (public.is_member(public.option_group(time_option_id)));
create policy votes_write  on public.event_votes for insert with check (user_id = auth.uid() and public.is_member(public.option_group(time_option_id)));
create policy votes_update on public.event_votes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy votes_delete on public.event_votes for delete using (user_id = auth.uid());

create policy rsvps_read   on public.event_rsvps for select using (public.is_member(public.event_group(event_id)));
create policy rsvps_write  on public.event_rsvps for insert with check (user_id = auth.uid() and public.is_member(public.event_group(event_id)));
create policy rsvps_update on public.event_rsvps for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Splitwise: everyone sees balances, only an admin links or unlinks.
-- The access token column is stripped by the app; never select * client-side.
create policy splitwise_read   on public.splitwise_links for select using (public.is_member(group_id));
create policy splitwise_insert on public.splitwise_links for insert with check (public.is_group_admin(group_id) and linked_by = auth.uid());
create policy splitwise_delete on public.splitwise_links for delete using (public.is_group_admin(group_id));

-- Albums: any member adds a link; the reminder job updates reminder_sent_at.
create policy albums_read   on public.album_links for select using (public.is_member(group_id));
create policy albums_insert on public.album_links for insert with check (public.is_member(group_id) and created_by = auth.uid());
create policy albums_update on public.album_links for update using (public.is_member(group_id));

-- Challenges: any member creates one and logs their own progress.
create policy challenges_read   on public.challenges for select using (public.is_member(group_id));
create policy challenges_insert on public.challenges for insert with check (public.is_member(group_id) and created_by = auth.uid());
create policy challenges_update on public.challenges for update using (public.is_member(group_id));

create policy entries_read   on public.challenge_entries for select using (public.is_member(public.challenge_group(challenge_id)));
create policy entries_insert on public.challenge_entries for insert with check (user_id = auth.uid() and public.is_member(public.challenge_group(challenge_id)));
create policy entries_delete on public.challenge_entries for delete using (user_id = auth.uid());
