-- Bereiche, Personalbedarf, Schicht→Bereich (einmalig in Supabase ausführen)

create table if not exists public.location_areas (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  unique (location_id, name)
);

create index if not exists location_areas_location_id_idx
  on public.location_areas (location_id);

create table if not exists public.location_area_staffing (
  id uuid primary key default gen_random_uuid(),
  location_area_id uuid not null references public.location_areas (id) on delete cascade,
  shift_type_id uuid not null references public.shift_types (id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 6),
  required_count int not null default 1 check (required_count >= 0),
  unique (location_area_id, shift_type_id, weekday)
);

create index if not exists location_area_staffing_area_id_idx
  on public.location_area_staffing (location_area_id);

alter table public.shifts
  add column if not exists location_area_id uuid references public.location_areas (id) on delete restrict;

create index if not exists shifts_location_area_id_idx on public.shifts (location_area_id);

-- Standard-Bereiche für bestehende Standorte
insert into public.location_areas (location_id, name, sort_order)
select l.id, a.name, a.ord
from public.locations l
cross join (
  values ('Restaurant', 0), ('BAR', 1), ('Küche', 2)
) as a(name, ord)
on conflict (location_id, name) do nothing;

alter table public.location_areas enable row level security;
alter table public.location_area_staffing enable row level security;

drop policy if exists "location_areas_select_org" on public.location_areas;
create policy "location_areas_select_org"
  on public.location_areas for select
  using (
    location_id in (
      select id from public.locations
      where organization_id in (select organization_id from public.current_profile())
    )
  );

drop policy if exists "location_areas_write_manager" on public.location_areas;
create policy "location_areas_write_manager"
  on public.location_areas for all
  using (
    location_id in (
      select l.id from public.locations l
      where l.organization_id in (
        select organization_id from public.current_profile()
        where role in ('owner', 'manager')
      )
    )
  )
  with check (
    location_id in (
      select l.id from public.locations l
      where l.organization_id in (
        select organization_id from public.current_profile()
        where role in ('owner', 'manager')
      )
    )
  );

drop policy if exists "location_area_staffing_select_org" on public.location_area_staffing;
create policy "location_area_staffing_select_org"
  on public.location_area_staffing for select
  using (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (select organization_id from public.current_profile())
    )
  );

drop policy if exists "location_area_staffing_write_manager" on public.location_area_staffing;
create policy "location_area_staffing_write_manager"
  on public.location_area_staffing for all
  using (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (
        select organization_id from public.current_profile()
        where role in ('owner', 'manager')
      )
    )
  )
  with check (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (
        select organization_id from public.current_profile()
        where role in ('owner', 'manager')
      )
    )
  );
