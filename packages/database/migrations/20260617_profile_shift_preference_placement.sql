-- Wunsch-Standort und Wunsch-Job (Bereich war bereits als location_area_id vorhanden)
alter table public.profile_shift_preferences
  add column if not exists location_id uuid references public.locations (id) on delete set null,
  add column if not exists qualification_id uuid references public.qualifications (id) on delete set null;

create index if not exists profile_shift_preferences_location_idx
  on public.profile_shift_preferences (location_id)
  where location_id is not null;

create index if not exists profile_shift_preferences_qualification_idx
  on public.profile_shift_preferences (qualification_id)
  where qualification_id is not null;

-- Bestehende Einträge: Standort aus Bereich ableiten
update public.profile_shift_preferences p
set location_id = a.location_id
from public.location_areas a
where p.location_area_id = a.id
  and p.location_id is null;
