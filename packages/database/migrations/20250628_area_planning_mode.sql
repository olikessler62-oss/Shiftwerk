-- Planungsmodus pro Bereich: simple (Standard) | advanced

alter table public.location_areas
  add column if not exists planning_mode text not null default 'simple'
  check (planning_mode in ('simple', 'advanced'));
