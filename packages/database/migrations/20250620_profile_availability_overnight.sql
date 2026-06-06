-- Verfügbarkeiten über Mitternacht (z. B. 22:00–06:00): end_time <= start_time = Folgetag
-- Idempotent — sicher mehrfach ausführbar.

alter table public.profile_recurring_availability
  drop constraint if exists profile_recurring_availability_time_check;

alter table public.profile_recurring_availability
  add constraint profile_recurring_availability_time_check
  check (start_time <> end_time);
