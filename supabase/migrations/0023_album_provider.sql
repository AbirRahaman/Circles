-- 0023: Add provider + name to shared albums, add delete policy
-- Run in Supabase SQL editor

alter table public.album_links
  add column provider text not null default 'apple'
    check (provider in ('apple', 'google')),
  add column name text not null default '';

-- Allow members to delete albums they created
create policy albums_delete on public.album_links
  for delete using (public.is_member(group_id) and created_by = auth.uid());
