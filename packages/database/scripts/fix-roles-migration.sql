-- Komplette Rollen-Migration (idempotent).
-- Einmal in Supabase ausführen — auch wenn frühere Versuche abgebrochen sind.

-- 1) Tabelle + Daten
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  name text not null,
  permission_level text not null check (permission_level in ('admin', 'manager', 'basic')),
  is_system boolean not null default false,
  sort_order int not null default 0,
  archived_at timestamptz,
  unique (organization_id, key)
);

create index if not exists roles_organization_id_idx
  on public.roles (organization_id);

insert into public.roles (organization_id, key, name, permission_level, is_system, sort_order)
select o.id, v.key, v.name, v.permission_level, true, v.sort_order
from public.organizations o
cross join (
  values
    ('admin', 'Administrator', 'admin', 0),
    ('manager', 'Manager', 'manager', 1),
    ('basic', 'Mitarbeiter', 'basic', 2)
) as v(key, name, permission_level, sort_order)
on conflict (organization_id, key) do nothing;

-- 2) profiles.role_id
alter table public.profiles add column if not exists role_id uuid references public.roles (id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    update public.profiles p
    set role_id = r.id
    from public.roles r
    where r.organization_id = p.organization_id
      and p.role_id is null
      and (
        (p.role::text = 'owner' and r.key = 'admin')
        or (p.role::text = 'manager' and r.key = 'manager')
        or (p.role::text = 'employee' and r.key = 'basic')
      );
  end if;
end $$;

update public.profiles p
set role_id = r.id
from public.roles r
where r.organization_id = p.organization_id
  and r.key = 'basic'
  and p.role_id is null;

alter table public.profiles drop column if exists role;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role_id'
      and is_nullable = 'YES'
  ) then
    alter table public.profiles alter column role_id set not null;
  end if;
end $$;

create index if not exists profiles_role_id_idx on public.profiles (role_id);

alter table public.roles enable row level security;

-- 3) Funktionen (DROP wegen geändertem Rückgabetyp)
drop function if exists public.current_profile() cascade;

create function public.current_profile()
returns table (organization_id uuid, permission_level text)
language sql
stable
security definer
set search_path = public
as $$
  select p.organization_id, r.permission_level
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

create or replace function public.is_manager_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.current_profile() cp
    where cp.permission_level in ('admin', 'manager')
  );
$$;

-- Policies (DROP + CREATE, falls CASCADE sie entfernt hat)
drop policy if exists "org_select_member" on public.organizations;
create policy "org_select_member"
  on public.organizations for select
  using (
    id in (select organization_id from public.current_profile())
  );

drop policy if exists "org_update_manager" on public.organizations;
create policy "org_update_manager"
  on public.organizations for update
  using (
    id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

drop policy if exists "profiles_select_org" on public.profiles;
create policy "profiles_select_org"
  on public.profiles for select
  using (
    organization_id in (select organization_id from public.current_profile())
  );

drop policy if exists "profiles_insert_self_or_manager" on public.profiles;
create policy "profiles_insert_self_or_manager"
  on public.profiles for insert
  with check (
    id = auth.uid()
    or public.is_manager_or_owner()
  );

drop policy if exists "profiles_update_manager_or_self" on public.profiles;
create policy "profiles_update_manager_or_self"
  on public.profiles for update
  using (
    id = auth.uid()
    or (
      organization_id in (select organization_id from public.current_profile())
      and public.is_manager_or_owner()
    )
  );

drop policy if exists "shift_types_select_org" on public.shift_types;
create policy "shift_types_select_org"
  on public.shift_types for select
  using (
    organization_id in (select organization_id from public.current_profile())
  );

drop policy if exists "shift_types_write_manager" on public.shift_types;
create policy "shift_types_write_manager"
  on public.shift_types for all
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

drop policy if exists "qualifications_select_org" on public.qualifications;
create policy "qualifications_select_org"
  on public.qualifications for select
  using (
    organization_id in (select organization_id from public.current_profile())
  );

drop policy if exists "qualifications_write_manager" on public.qualifications;
create policy "qualifications_write_manager"
  on public.qualifications for all
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

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
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    location_id in (
      select l.id from public.locations l
      where l.organization_id in (
        select organization_id from public.current_profile()
        where permission_level in ('admin', 'manager')
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
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (
        select organization_id from public.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

drop policy if exists "roles_select_org" on public.roles;
create policy "roles_select_org"
  on public.roles for select
  using (
    organization_id in (select organization_id from public.current_profile())
  );

drop policy if exists "roles_write_manager" on public.roles;
create policy "roles_write_manager"
  on public.roles for all
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

drop policy if exists "locations_select_org" on public.locations;
create policy "locations_select_org"
  on public.locations for select
  using (
    organization_id in (select organization_id from public.current_profile())
  );

drop policy if exists "locations_write_manager" on public.locations;
create policy "locations_write_manager"
  on public.locations for all
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

drop policy if exists "shift_type_breaks_select_org" on public.shift_type_breaks;
create policy "shift_type_breaks_select_org"
  on public.shift_type_breaks for select
  using (
    shift_type_id in (
      select id from public.shift_types
      where organization_id in (select organization_id from public.current_profile())
    )
  );

drop policy if exists "shift_type_breaks_write_manager" on public.shift_type_breaks;
create policy "shift_type_breaks_write_manager"
  on public.shift_type_breaks for all
  using (
    shift_type_id in (
      select st.id from public.shift_types st
      where st.organization_id in (
        select organization_id from public.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    shift_type_id in (
      select st.id from public.shift_types st
      where st.organization_id in (
        select organization_id from public.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

drop policy if exists "shifts_select" on public.shifts;
create policy "shifts_select"
  on public.shifts for select
  using (
    employee_id = auth.uid()
    or (
      organization_id in (select organization_id from public.current_profile())
      and public.is_manager_or_owner()
    )
  );

drop policy if exists "shifts_write_manager" on public.shifts;
create policy "shifts_write_manager"
  on public.shifts for insert
  with check (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

drop policy if exists "shifts_update_manager" on public.shifts;
create policy "shifts_update_manager"
  on public.shifts for update
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

drop policy if exists "shifts_delete_manager" on public.shifts;
create policy "shifts_delete_manager"
  on public.shifts for delete
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

drop policy if exists "availability_select" on public.availability;
create policy "availability_select"
  on public.availability for select
  using (
    employee_id = auth.uid()
    or (
      organization_id in (select organization_id from public.current_profile())
      and public.is_manager_or_owner()
    )
  );

drop policy if exists "absence_select" on public.absence_requests;
create policy "absence_select"
  on public.absence_requests for select
  using (
    employee_id = auth.uid()
    or (
      organization_id in (select organization_id from public.current_profile())
      and public.is_manager_or_owner()
    )
  );

drop policy if exists "absence_update_manager" on public.absence_requests;
create policy "absence_update_manager"
  on public.absence_requests for update
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

drop policy if exists "swap_select" on public.swap_requests;
create policy "swap_select"
  on public.swap_requests for select
  using (
    requester_id = auth.uid()
    or target_employee_id = auth.uid()
    or (
      organization_id in (select organization_id from public.current_profile())
      and public.is_manager_or_owner()
    )
  );

drop policy if exists "swap_update_manager_or_requester" on public.swap_requests;
create policy "swap_update_manager_or_requester"
  on public.swap_requests for update
  using (
    requester_id = auth.uid()
    or (
      organization_id in (
        select organization_id from public.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

drop policy if exists "coworkers_via_profiles" on public.profiles;
create policy "coworkers_via_profiles"
  on public.profiles for select
  using (
    organization_id in (select organization_id from public.current_profile())
  );
