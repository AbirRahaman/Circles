-- People mistype the amount. Let them fix their own entries.
-- Deleting was already permitted by entries_delete in 0002; this adds
-- the matching update policy, still scoped to your own rows.

create policy entries_update on public.challenge_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
