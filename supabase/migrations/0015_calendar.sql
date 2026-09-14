-- A per-user secret for the calendar feed. Calendar clients can't sign in,
-- so this token IS the credential: 64 hex characters, and rotating it
-- revokes every subscription that used the old one.

alter table public.profiles
  add column if not exists calendar_token text unique;

create or replace function public.new_calendar_token()
returns text language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;
