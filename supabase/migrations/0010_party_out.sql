-- Tapping out. The tally stays; the person is marked done for the night.
-- event_party had no update policy — writes to it were insert/delete only —
-- so this adds one, scoped to your own row.

alter table public.event_party
  add column if not exists out_at timestamptz;

create policy party_update on public.event_party
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
