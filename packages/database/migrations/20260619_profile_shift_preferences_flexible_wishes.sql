-- Flexible Wünsche: Zeit optional; mindestens eine Dimension (Zeit, Standort, Bereich, Tätigkeit)
alter table public.profile_shift_preferences
  alter column weekday drop not null,
  alter column start_time drop not null,
  alter column end_time drop not null;

alter table public.profile_shift_preferences
  drop constraint if exists profile_shift_preferences_time_check;

alter table public.profile_shift_preferences
  add constraint profile_shift_preferences_time_pair_check check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and start_time <> end_time)
  );

alter table public.profile_shift_preferences
  add constraint profile_shift_preferences_weekday_time_check check (
    (weekday is null) = (start_time is null and end_time is null)
  );

alter table public.profile_shift_preferences
  add constraint profile_shift_preferences_dimension_check check (
    (weekday is not null and start_time is not null and end_time is not null)
    or location_id is not null
    or location_area_id is not null
    or qualification_id is not null
  );
