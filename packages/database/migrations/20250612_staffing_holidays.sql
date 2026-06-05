-- Personalbedarf: Feiertage als weekday 7 (einmalig in Supabase ausführen)

alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_weekday_check;

alter table public.location_area_staffing
  add constraint location_area_staffing_weekday_check
  check (weekday >= 0 and weekday <= 7);
