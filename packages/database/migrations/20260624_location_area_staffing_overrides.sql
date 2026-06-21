-- Temporäre Personalbedarf-Overrides pro Bereich, Datum und Servicezeit-Fenster

create table if not exists public.location_area_staffing_overrides (
  id uuid primary key default gen_random_uuid(),
  location_area_id uuid not null references public.location_areas (id) on delete cascade,
  shift_date date not null,
  service_hour_id uuid not null references public.location_area_service_hours (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete restrict,
  required_count int not null check (required_count >= 0),
  unique (location_area_id, shift_date, service_hour_id, qualification_id)
);

create index if not exists location_area_staffing_overrides_area_date_idx
  on public.location_area_staffing_overrides (location_area_id, shift_date);

alter table public.location_area_staffing_overrides enable row level security;

drop policy if exists "location_area_staffing_overrides_select_org"
  on public.location_area_staffing_overrides;
create policy "location_area_staffing_overrides_select_org"
  on public.location_area_staffing_overrides for select
  using (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (select organization_id from private.current_profile())
    )
  );

drop policy if exists "location_area_staffing_overrides_write_manager"
  on public.location_area_staffing_overrides;
create policy "location_area_staffing_overrides_write_manager"
  on public.location_area_staffing_overrides for all
  using (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );
