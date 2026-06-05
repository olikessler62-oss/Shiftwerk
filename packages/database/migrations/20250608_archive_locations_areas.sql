-- Archivierung statt Löschen (Kosten-/Schicht-Historie bleibt referenzierbar)

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
