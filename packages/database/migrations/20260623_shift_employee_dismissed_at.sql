-- Mitarbeiter können stornierte Schichten aus der Mobile-App ausblenden.
alter table public.shifts
  add column if not exists employee_dismissed_at timestamptz;

create index if not exists shifts_employee_dismissed_at_idx
  on public.shifts (employee_id, employee_dismissed_at)
  where employee_dismissed_at is null;
