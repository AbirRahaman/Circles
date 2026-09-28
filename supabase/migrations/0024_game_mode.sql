-- Single phone vs multi phone
alter table public.games
  add column mode text not null default 'multi'
  check (mode in ('single', 'multi'));
