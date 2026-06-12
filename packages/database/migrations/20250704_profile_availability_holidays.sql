-- Verfügbarkeiten: Feiertage als weekday 7 (einmalig in Supabase ausführen)

alter table public.profile_recurring_availability
  drop constraint if exists profile_recurring_availability_weekday_check;

alter table public.profile_recurring_availability
  add constraint profile_recurring_availability_weekday_check
  check (weekday >= 0 and weekday <= 7);
