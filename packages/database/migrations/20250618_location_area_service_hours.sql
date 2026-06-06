-- Service-Zeiten pro Bereich (Mo–So + Feiertage); Standort-Felder active_weekdays/on_holiday_open entfernen

create table if not exists public.location_area_service_hours (
  id uuid primary key default gen_random_uuid(),
  location_area_id uuid not null references public.location_areas (id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 7),
  start_time time not null,
  end_time time not null,
  constraint location_area_service_hours_time_order check (end_time > start_time),
  unique (location_area_id, weekday)
);

create index if not exists location_area_service_hours_area_id_idx
  on public.location_area_service_hours (location_area_id);

alter table public.location_area_service_hours enable row level security;

-- Bestehende Standort-Öffnungstage auf Bereiche übertragen (nur wenn alte Spalten noch existieren)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'locations'
      and column_name = 'active_weekdays'
  ) then
    insert into public.location_area_service_hours (location_area_id, weekday, start_time, end_time)
    select la.id, gs.weekday, '09:00'::time, '18:00'::time
    from public.location_areas la
    join public.locations l on l.id = la.location_id
    cross join generate_series(0, 6) as gs(weekday)
    where substring(l.active_weekdays from (gs.weekday + 1) for 1) = '1'
    on conflict (location_area_id, weekday) do nothing;

    insert into public.location_area_service_hours (location_area_id, weekday, start_time, end_time)
    select la.id, 7, '10:00'::time, '16:00'::time
    from public.location_areas la
    join public.locations l on l.id = la.location_id
    where l.on_holiday_open = true
    on conflict (location_area_id, weekday) do nothing;
  end if;
end $$;

alter table public.locations drop constraint if exists locations_active_weekdays_check;
alter table public.locations drop column if exists active_weekdays;
alter table public.locations drop column if exists on_holiday_open;

drop policy if exists "location_area_service_hours_select_org" on public.location_area_service_hours;
create policy "location_area_service_hours_select_org"
  on public.location_area_service_hours for select
  using (
    location_area_id in (
      select la.id
      from public.location_areas la
      join public.locations loc on loc.id = la.location_id
      where loc.organization_id in (select organization_id from private.current_profile())
    )
  );

drop policy if exists "location_area_service_hours_write_manager" on public.location_area_service_hours;
create policy "location_area_service_hours_write_manager"
  on public.location_area_service_hours for all
  using (
    location_area_id in (
      select la.id
      from public.location_areas la
      join public.locations loc on loc.id = la.location_id
      where loc.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    location_area_id in (
      select la.id
      from public.location_areas la
      join public.locations loc on loc.id = la.location_id
      where loc.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );
