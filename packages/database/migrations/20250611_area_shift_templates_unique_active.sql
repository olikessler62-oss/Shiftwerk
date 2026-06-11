-- Eindeutige Bezeichnung nur unter aktiven (nicht archivierten) Schichtvorlagen pro Bereich

alter table public.area_shift_templates
  drop constraint if exists area_shift_templates_location_area_id_name_key;

create unique index if not exists area_shift_templates_location_area_id_name_active_key
  on public.area_shift_templates (location_area_id, name)
  where archived_at is null;
