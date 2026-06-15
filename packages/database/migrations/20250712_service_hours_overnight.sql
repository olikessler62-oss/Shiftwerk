-- Servicezeiten über Mitternacht (z. B. Di 21:00–Mi 05:00): end_time <= start_time = Folgetag
-- Idempotent — sicher mehrfach ausführbar.

alter table public.location_area_service_hours
  drop constraint if exists location_area_service_hours_time_order;

alter table public.location_area_service_hours
  add constraint location_area_service_hours_time_order
  check (start_time <> end_time);
