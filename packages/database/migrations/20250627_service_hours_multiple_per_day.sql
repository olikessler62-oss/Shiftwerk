-- Mehrere Servicezeiten pro Tag (z. B. Vormittag + Nachmittag)

alter table public.location_area_service_hours
  drop constraint if exists location_area_service_hours_location_area_id_weekday_key;

create index if not exists location_area_service_hours_area_weekday_start_idx
  on public.location_area_service_hours (location_area_id, weekday, start_time);
