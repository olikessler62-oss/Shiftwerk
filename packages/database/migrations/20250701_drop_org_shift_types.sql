-- Phase 4: Org-Schichtarten entfernen; Schichtvorlagen pro Bereich als Referenz

alter table public.shifts
  add column if not exists area_shift_template_id uuid
    references public.area_shift_templates (id) on delete set null;

create index if not exists shifts_area_shift_template_id_idx
  on public.shifts (area_shift_template_id);

-- Bestehende Schichten anhand Bereich + Uhrzeiten zuordnen
update public.shifts s
set area_shift_template_id = ast.id
from public.area_shift_templates ast
where s.location_area_id = ast.location_area_id
  and ast.archived_at is null
  and s.area_shift_template_id is null
  and to_char(s.starts_at at time zone 'UTC', 'HH24:MI') = left(ast.start_time::text, 5)
  and to_char(s.ends_at at time zone 'UTC', 'HH24:MI') = left(ast.end_time::text, 5);

alter table public.shifts drop constraint if exists shifts_shift_type_id_fkey;
alter table public.shifts drop column if exists shift_type_id;

alter table public.profile_recurring_availability
  drop constraint if exists profile_recurring_availability_shift_type_id_fkey;
alter table public.profile_recurring_availability
  drop column if exists shift_type_id;

drop policy if exists "shift_type_breaks_select_org" on public.shift_type_breaks;
drop policy if exists "shift_type_breaks_write_manager" on public.shift_type_breaks;
drop policy if exists "shift_types_select_org" on public.shift_types;
drop policy if exists "shift_types_write_manager" on public.shift_types;

drop table if exists public.shift_type_breaks;
drop table if exists public.shift_types;
