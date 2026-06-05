-- Einmal im Supabase SQL Editor ausführen (idempotent).
-- Behebt: "column locations.archived_at does not exist"
-- Entspricht migrations/20250608 + 20250609

alter table public.locations
  add column if not exists archived_at timestamptz;

alter table public.location_areas
  add column if not exists archived_at timestamptz;

create index if not exists locations_active_idx
  on public.locations (organization_id)
  where archived_at is null;

create index if not exists location_areas_active_idx
  on public.location_areas (location_id)
  where archived_at is null;

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
