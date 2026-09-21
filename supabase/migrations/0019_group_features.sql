-- 0019: Optional per-group features. Behavior ratings are opt-in, off by default.
-- Existing groups start off too; an admin turns it on in Settings.

alter table public.friend_groups
  add column if not exists behavior_enabled boolean not null default false;

-- Writes are refused while the group has the feature switched off, so the
-- toggle is enforced in Postgres, not just hidden in the UI.
create or replace function public.can_set_behavior(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.friend_groups g
           where g.id = public.event_group(e) and g.behavior_enabled
         )
     and (
           exists (select 1 from public.events ev where ev.id = e and ev.created_by = auth.uid())
        or exists (select 1 from public.event_cohosts c where c.event_id = e and c.user_id = auth.uid())
        or public.is_group_admin(public.event_group(e))
     );
$$;
