-- Sonntagsarbeit als Zuschlags-Bedingung (neben Feiertag).
alter table public.compensation_surcharge_types
  drop constraint if exists compensation_surcharge_types_trigger_check;

alter table public.compensation_surcharge_types
  add constraint compensation_surcharge_types_trigger_check
  check (trigger in ('public_holiday', 'sunday'));
