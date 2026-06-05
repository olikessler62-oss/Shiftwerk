-- Archivierung für Schichtarten und Qualifikationen

alter table public.shift_types
  add column if not exists archived_at timestamptz;

alter table public.qualifications
  add column if not exists archived_at timestamptz;

create index if not exists shift_types_active_idx
  on public.shift_types (organization_id)
  where archived_at is null;

create index if not exists qualifications_active_idx
  on public.qualifications (organization_id)
  where archived_at is null;
