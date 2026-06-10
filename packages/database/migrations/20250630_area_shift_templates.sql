-- Bereichs-Schichtvorlagen (Kurzwahl beim Zuweisen, optional pro Bereich)

create table if not exists public.area_shift_templates (
  id uuid primary key default gen_random_uuid(),
  location_area_id uuid not null references public.location_areas (id) on delete cascade,
  name text not null,
  color text not null default '#0D9488',
  start_time time not null,
  end_time time not null,
  sort_order int not null default 0,
  archived_at timestamptz,
  unique (location_area_id, name)
);

create index if not exists area_shift_templates_location_area_id_idx
  on public.area_shift_templates (location_area_id);

create table if not exists public.area_shift_template_breaks (
  id uuid primary key default gen_random_uuid(),
  area_shift_template_id uuid not null references public.area_shift_templates (id) on delete cascade,
  break_start time not null,
  break_end time not null,
  sort_order int not null default 0
);

create index if not exists area_shift_template_breaks_template_id_idx
  on public.area_shift_template_breaks (area_shift_template_id);

alter table public.area_shift_templates enable row level security;
alter table public.area_shift_template_breaks enable row level security;

drop policy if exists "area_shift_templates_select_org" on public.area_shift_templates;
create policy "area_shift_templates_select_org"
  on public.area_shift_templates for select
  using (
    location_area_id in (
      select la.id
      from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (select organization_id from private.current_profile())
    )
  );

drop policy if exists "area_shift_templates_write_manager" on public.area_shift_templates;
create policy "area_shift_templates_write_manager"
  on public.area_shift_templates for all
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

drop policy if exists "area_shift_template_breaks_select_org" on public.area_shift_template_breaks;
create policy "area_shift_template_breaks_select_org"
  on public.area_shift_template_breaks for select
  using (
    area_shift_template_id in (
      select ast.id
      from public.area_shift_templates ast
      join public.location_areas la on la.id = ast.location_area_id
      join public.locations l on l.id = la.location_id
      where l.organization_id in (select organization_id from private.current_profile())
    )
  );

drop policy if exists "area_shift_template_breaks_write_manager" on public.area_shift_template_breaks;
create policy "area_shift_template_breaks_write_manager"
  on public.area_shift_template_breaks for all
  using (
    area_shift_template_id in (
      select ast.id
      from public.area_shift_templates ast
      join public.location_areas la on la.id = ast.location_area_id
      join public.locations l on l.id = la.location_id
      where l.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    area_shift_template_id in (
      select ast.id
      from public.area_shift_templates ast
      join public.location_areas la on la.id = ast.location_area_id
      join public.locations l on l.id = la.location_id
      where l.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );
