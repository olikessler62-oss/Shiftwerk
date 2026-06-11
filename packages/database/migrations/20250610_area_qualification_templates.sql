-- Funktionsvorlagen pro Bereich (Personalbedarf / Zuweisung)

create table if not exists public.area_qualification_templates (
  id uuid primary key default gen_random_uuid(),
  location_area_id uuid not null references public.location_areas (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete restrict,
  sort_order int not null default 0,
  unique (location_area_id, qualification_id)
);

create index if not exists area_qualification_templates_location_area_id_idx
  on public.area_qualification_templates (location_area_id);

create index if not exists area_qualification_templates_qualification_id_idx
  on public.area_qualification_templates (qualification_id);

alter table public.area_qualification_templates enable row level security;

drop policy if exists "area_qualification_templates_select_org" on public.area_qualification_templates;
create policy "area_qualification_templates_select_org"
  on public.area_qualification_templates for select
  using (
    location_area_id in (
      select la.id
      from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (select organization_id from private.current_profile())
    )
  );

drop policy if exists "area_qualification_templates_write_manager" on public.area_qualification_templates;
create policy "area_qualification_templates_write_manager"
  on public.area_qualification_templates for all
  using (
    location_area_id in (
      select la.id
      from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    location_area_id in (
      select la.id
      from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );
