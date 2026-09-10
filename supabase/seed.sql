-- Circles — development seed
--
-- Defines dev_seed(email): builds a filled-in group around a user who has
-- already signed in once, plus four fake friends, so every screen has
-- something to render while you work on the UI.
--
--   1. Run the app, sign in with your email, land on the empty groups screen.
--   2. In the SQL editor:  select dev_seed('you@example.com');
--   3. Refresh the app.
--
-- DEV ONLY. This inserts rows directly into auth.users, which is fine for a
-- local or throwaway project and wrong for anything real. Re-running it makes
-- a second group rather than updating the first.

create or replace function public.dev_fake_user(p_email text, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is not null then return uid; end if;

  uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    p_email, crypt('circles-dev-password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', p_name),
    '', '', '', ''
  );
  -- the on_auth_user_created trigger writes the matching profiles row
  return uid;
end $$;

create or replace function public.dev_seed(p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid; g uuid;
  maya uuid; devon uuid; priya uuid; sam uuid;
  ev_open uuid; ev_past uuid;
  o1 uuid; o2 uuid; o3 uuid;
  ch uuid;
begin
  select id into me from auth.users where email = p_email;
  if me is null then
    raise exception 'No user with email %. Sign in to the app once first, then re-run.', p_email;
  end if;

  maya  := dev_fake_user('maya@circles.test',  'Maya');
  devon := dev_fake_user('devon@circles.test', 'Devon');
  priya := dev_fake_user('priya@circles.test', 'Priya');
  sam   := dev_fake_user('sam@circles.test',   'Sam');

  insert into friend_groups (name, created_by) values ('Cabin Crew', me) returning id into g;

  insert into memberships (user_id, group_id, role, status, joined_at) values
    (me,    g, 'admin',  'active', now() - interval '30 days'),
    (maya,  g, 'admin',  'active', now() - interval '29 days'),
    (devon, g, 'member', 'active', now() - interval '28 days'),
    (priya, g, 'member', 'active', now() - interval '27 days'),
    (sam,   g, 'member', 'active', now() - interval '26 days');

  insert into invites (group_id, created_by) values (g, me);

  -- An open poll, already voted on by everyone except you, so there is
  -- something to click and a "Confirm a time" button that does real work.
  insert into events (group_id, created_by, title, location, notes, status)
  values (g, maya, 'Cabin weekend', 'Mohonk, NY', 'Two nights. Devon is driving, four seats.', 'proposed')
  returning id into ev_open;

  insert into event_time_options (event_id, proposed_time)
    values (ev_open, date_trunc('hour', now() + interval '9 days')  + interval '17 hours') returning id into o1;
  insert into event_time_options (event_id, proposed_time)
    values (ev_open, date_trunc('hour', now() + interval '16 days') + interval '17 hours') returning id into o2;
  insert into event_time_options (event_id, proposed_time)
    values (ev_open, date_trunc('hour', now() + interval '23 days') + interval '17 hours') returning id into o3;

  insert into event_votes (time_option_id, user_id, response) values
    (o1, maya, 'yes'),   (o2, maya, 'yes'),   (o3, maya, 'no'),
    (o1, devon, 'no'),   (o2, devon, 'yes'),  (o3, devon, 'maybe'),
    (o1, priya, 'maybe'),(o2, priya, 'yes'),  (o3, priya, 'yes'),
    (o1, sam, 'yes'),    (o2, sam, 'maybe'),  (o3, sam, 'no');

  -- A past confirmed event, so the RSVP layout and the Past list have content.
  insert into events (group_id, created_by, title, location, notes, status, confirmed_time)
  values (g, priya, 'Priya''s birthday dinner', 'Lucia, Brooklyn', 'Reservation under Maya, 7:30.',
          'confirmed', date_trunc('hour', now() - interval '3 days') + interval '19 hours')
  returning id into ev_past;

  insert into event_rsvps (event_id, user_id, response) values
    (ev_past, me, 'going'), (ev_past, maya, 'going'), (ev_past, devon, 'going'),
    (ev_past, priya, 'going'), (ev_past, sam, 'not_going');

  -- Un-nudged and more than 24h past the event, so the reminder card shows.
  insert into album_links (group_id, event_id, icloud_share_url, created_by)
  values (g, ev_past, 'https://www.icloud.com/sharedalbum/#B0eGZ4example', maya);

  insert into challenges (group_id, title, type, unit, target, target_mode, start_date, end_date, created_by)
  values (g, '100 miles in October', 'distance', 'miles', 100, 'per_person',
          current_date - 12, current_date + 18, devon)
  returning id into ch;

  insert into challenge_entries (challenge_id, user_id, amount, note) values
    (ch, me,    6.2, 'River loop'),
    (ch, devon, 12,  'Long run'),
    (ch, devon, 5,   null),
    (ch, maya,  9.5, 'Prospect Park'),
    (ch, priya, 4,   'Treadmill'),
    (ch, sam,   7.1, null),
    (ch, maya,  3.2, null);

  return g;
end $$;
