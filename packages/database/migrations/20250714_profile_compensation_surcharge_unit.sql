alter table public.profile_compensation_surcharges
  add column if not exists unit text check (unit is null or unit in ('eur_per_hour', 'percent_of_base'));
