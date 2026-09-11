-- Getting there is half of every plan: who is driving, who has a seat,
-- and when they expect to arrive.

create table public.event_cars (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  driver_id   uuid not null references public.profiles (id),
  seats       int  not null default 3 check (seats between 1 and 12),
  leaving_from text,
  leaves_at   timestamptz,
  eta         timestamptz,
  note        text,
  created_at  timestamptz not null default now(),
  unique (event_id, driver_id)   -- one car per driver per event
);
create index event_cars_by_event on public.event_cars (event_id);

create table public.car_passengers (
  id        uuid primary key default gen_random_uuid(),
  car_id    uuid not null references public.event_cars (id) on delete cascade,
  user_id   uuid not null references public.profiles (id),
  joined_at timestamptz not null default now(),
  unique (car_id, user_id)
);
create index car_passengers_by_car on public.car_passengers (car_id);

create or replace function public.car_group(c uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.group_id
  from public.event_cars ec
  join public.events e on e.id = ec.event_id
  where ec.id = c;
$$;

alter table public.event_cars     enable row level security;
alter table public.car_passengers enable row level security;

-- Members see every car. Only the driver offers or edits their own,
-- and an admin can clear one up.
create policy cars_read   on public.event_cars for select using (public.is_member(public.event_group(event_id)));
create policy cars_insert on public.event_cars for insert with check (public.is_member(public.event_group(event_id)) and driver_id = auth.uid());
create policy cars_update on public.event_cars for update using (driver_id = auth.uid() or public.is_group_admin(public.event_group(event_id)));
create policy cars_delete on public.event_cars for delete using (driver_id = auth.uid() or public.is_group_admin(public.event_group(event_id)));

-- You claim your own seat. The driver can also drop someone from their car.
create policy pax_read   on public.car_passengers for select using (public.is_member(public.car_group(car_id)));
create policy pax_insert on public.car_passengers for insert with check (user_id = auth.uid() and public.is_member(public.car_group(car_id)));
create policy pax_delete on public.car_passengers for delete using (
  user_id = auth.uid()
  or exists (select 1 from public.event_cars ec where ec.id = car_id and ec.driver_id = auth.uid())
);
