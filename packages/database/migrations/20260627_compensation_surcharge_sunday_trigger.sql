-- Sonntagsarbeit als Zuschlags-Bedingung (idempotent, falls 20250713 noch nicht ausgeführt wurde).
alter table public.compensation_surcharge_types
  drop constraint if exists compensation_surcharge_types_trigger_check;

alter table public.compensation_surcharge_types
  add constraint compensation_surcharge_types_trigger_check
  check (trigger in ('public_holiday', 'sunday'));
