-- Carpools are usually arranged by one person on everyone's behalf, not
-- self-served. Any member can now add a car, name its driver, and seat
-- people in it. A car can also exist before anyone has agreed to drive it.

alter table public.event_cars alter column driver_id drop not null;
alter table public.event_cars add column if not exists label text;

-- Cars: any active member of the group may add, edit or remove one.
drop policy if exists cars_insert on public.event_cars;
drop policy if exists cars_update on public.event_cars;
drop policy if exists cars_delete on public.event_cars;

create policy cars_insert on public.event_cars
  for insert with check (public.is_member(public.event_group(event_id)));
create policy cars_update on public.event_cars
  for update using (public.is_member(public.event_group(event_id)));
create policy cars_delete on public.event_cars
  for delete using (public.is_member(public.event_group(event_id)));

-- Seats: any member can seat anyone, including themselves.
drop policy if exists pax_insert on public.car_passengers;
drop policy if exists pax_delete on public.car_passengers;

create policy pax_insert on public.car_passengers
  for insert with check (public.is_member(public.car_group(car_id)));
create policy pax_delete on public.car_passengers
  for delete using (public.is_member(public.car_group(car_id)));
