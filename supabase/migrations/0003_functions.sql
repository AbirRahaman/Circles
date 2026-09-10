-- Circles — membership transitions and the event flow.
-- These run security definer because they legitimately cross the RLS line
-- (an invite link is followed by someone who is not a member yet), so each
-- one re-checks permission itself before it writes.

-- Create a group and make the creator its first admin.
create or replace function public.create_group(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into friend_groups (name, created_by) values (p_name, auth.uid()) returning id into g;
  insert into memberships (user_id, group_id, role, status, joined_at)
  values (auth.uid(), g, 'admin', 'active', now());
  insert into invites (group_id, created_by) values (g, auth.uid());
  return g;
end $$;

-- Follow an invite link. A returning member gets a NEW membership row.
create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv invites%rowtype; existing memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select * into inv from invites
  where token = p_token and revoked_at is null
    and (expires_at is null or expires_at > now());
  if not found then raise exception 'invite_invalid'; end if;

  select * into existing from memberships
  where group_id = inv.group_id and user_id = auth.uid() and status <> 'left';

  if found then
    if existing.status = 'invited' then
      update memberships set status = 'active', joined_at = now() where id = existing.id;
    end if;
    return inv.group_id;
  end if;

  insert into memberships (user_id, group_id, role, status, joined_at)
  values (auth.uid(), inv.group_id, 'member', 'active', now());
  return inv.group_id;
end $$;

create or replace function public.leave_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update memberships set status = 'left', left_at = now()
  where group_id = p_group and user_id = auth.uid() and status <> 'left';
end $$;

create or replace function public.remove_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_group_admin(p_group) then raise exception 'admin_only'; end if;
  if p_user = auth.uid() then raise exception 'use leave_group'; end if;
  update memberships set status = 'left', left_at = now()
  where group_id = p_group and user_id = p_user and status <> 'left';
end $$;

create or replace function public.set_member_role(p_group uuid, p_user uuid, p_role membership_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_group_admin(p_group) then raise exception 'admin_only'; end if;
  update memberships set role = p_role
  where group_id = p_group and user_id = p_user and status = 'active';
end $$;

-- Confirm the winning slot. Human judgement picks it (spec 4.1 step 3);
-- this just carries yes/maybe voters over as RSVPs in one transaction.
create or replace function public.confirm_event_time(p_event uuid, p_option uuid)
returns void language plpgsql security definer set search_path = public as $$
declare g uuid; t timestamptz; creator uuid;
begin
  select group_id, created_by into g, creator from events where id = p_event;
  if g is null then raise exception 'event_not_found'; end if;
  if not is_member(g) then raise exception 'not_a_member'; end if;
  if creator <> auth.uid() and not is_group_admin(g) then raise exception 'creator_or_admin_only'; end if;

  select proposed_time into t from event_time_options where id = p_option and event_id = p_event;
  if t is null then raise exception 'option_not_found'; end if;

  update events set status = 'confirmed', confirmed_time = t where id = p_event;

  insert into event_rsvps (event_id, user_id, response)
  select p_event, v.user_id, case v.response when 'yes' then 'going'::rsvp_response else 'maybe'::rsvp_response end
  from event_votes v
  where v.time_option_id = p_option and v.response in ('yes', 'maybe')
  on conflict (event_id, user_id) do update set response = excluded.response, updated_at = now();
end $$;

-- Album links whose event ended more than 24h ago and that were never
-- nudged. The cron route reads this and sends one reminder each.
create or replace function public.album_reminders_due()
returns table (album_id uuid, group_id uuid, event_title text, url text)
language sql security definer set search_path = public as $$
  select a.id, a.group_id, e.title, a.icloud_share_url
  from album_links a
  join events e on e.id = a.event_id
  where a.reminder_sent_at is null
    and e.status = 'confirmed'
    and e.confirmed_time < now() - interval '24 hours'
    and e.confirmed_time > now() - interval '30 days';
$$;
