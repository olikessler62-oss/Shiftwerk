-- Security linter fixes (Supabase):
-- - set_updated_at: immutable search_path
-- - RLS helpers moved to private schema (not callable via PostgREST /rest/v1/rpc)

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, authenticated, service_role;

create or replace function private.current_profile()
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

create or replace function private.is_manager_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from private.current_profile() cp
    where cp.permission_level in ('admin', 'manager')
  );
$$;

revoke all on function private.current_profile() from public;
revoke all on function private.is_manager_or_owner() from public;
grant execute on function private.current_profile() to authenticated, service_role;
grant execute on function private.is_manager_or_owner() to authenticated, service_role;

drop function if exists public.is_manager_or_owner() cascade;
drop function if exists public.current_profile() cascade;
-- Organizations
drop policy if exists "org_select_member" on public.organizations;
create policy "org_select_member"
  on public.organizations for select
  using (
    id in (select organization_id from private.current_profile())
  );

drop policy if exists "org_insert_owner_signup" on public.organizations;
create policy "org_insert_owner_signup"
  on public.organizations for insert
  with check (auth.uid() is not null);

drop policy if exists "org_update_manager" on public.organizations;
create policy "org_update_manager"
  on public.organizations for update
  using (
    id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

-- Profiles
drop policy if exists "profiles_select_org" on public.profiles;
create policy "profiles_select_org"
  on public.profiles for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

drop policy if exists "profiles_insert_self_or_manager" on public.profiles;
create policy "profiles_insert_self_or_manager"
  on public.profiles for insert
  with check (
    id = auth.uid()
    or private.is_manager_or_owner()
  );

drop policy if exists "profiles_update_manager_or_self" on public.profiles;
create policy "profiles_update_manager_or_self"
  on public.profiles for update
  using (
    id = auth.uid()
    or (
      organization_id in (select organization_id from private.current_profile())
      and private.is_manager_or_owner()
    )
  );

-- Shift types
drop policy if exists "shift_types_select_org" on public.shift_types;
create policy "shift_types_select_org"
  on public.shift_types for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

drop policy if exists "shift_types_write_manager" on public.shift_types;
create policy "shift_types_write_manager"
  on public.shift_types for all
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

-- Qualifications
drop policy if exists "qualifications_select_org" on public.qualifications;
create policy "qualifications_select_org"
  on public.qualifications for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

drop policy if exists "qualifications_write_manager" on public.qualifications;
create policy "qualifications_write_manager"
  on public.qualifications for all
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

-- Profile qualifications
drop policy if exists "profile_qualifications_select_org" on public.profile_qualifications;
create policy "profile_qualifications_select_org"
  on public.profile_qualifications for select
  using (
    profile_id in (
      select id from public.profiles
      where organization_id in (select organization_id from private.current_profile())
    )
  );

drop policy if exists "profile_qualifications_write_manager" on public.profile_qualifications;
create policy "profile_qualifications_write_manager"
  on public.profile_qualifications for all
  using (
    profile_id in (
      select p.id from public.profiles p
      where p.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    profile_id in (
      select p.id from public.profiles p
      where p.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

-- Profile recurring availability
drop policy if exists "profile_recurring_availability_select_org" on public.profile_recurring_availability;
create policy "profile_recurring_availability_select_org"
  on public.profile_recurring_availability for select
  using (
    profile_id in (
      select id from public.profiles
      where organization_id in (select organization_id from private.current_profile())
    )
  );

drop policy if exists "profile_recurring_availability_write_manager" on public.profile_recurring_availability;
create policy "profile_recurring_availability_write_manager"
  on public.profile_recurring_availability for all
  using (
    profile_id in (
      select p.id from public.profiles p
      where p.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    profile_id in (
      select p.id from public.profiles p
      where p.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

drop policy if exists "profile_recurring_availability_write_own" on public.profile_recurring_availability;
create policy "profile_recurring_availability_write_own"
  on public.profile_recurring_availability for insert
  with check (profile_id = auth.uid());

drop policy if exists "profile_recurring_availability_update_own" on public.profile_recurring_availability;
create policy "profile_recurring_availability_update_own"
  on public.profile_recurring_availability for update
  using (profile_id = auth.uid());

drop policy if exists "profile_recurring_availability_delete_own" on public.profile_recurring_availability;
create policy "profile_recurring_availability_delete_own"
  on public.profile_recurring_availability for delete
  using (profile_id = auth.uid());

-- Profile hourly rates
drop policy if exists "profile_hourly_rates_select_org" on public.profile_hourly_rates;
create policy "profile_hourly_rates_select_org"
  on public.profile_hourly_rates for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

drop policy if exists "profile_hourly_rates_write_manager" on public.profile_hourly_rates;
create policy "profile_hourly_rates_write_manager"
  on public.profile_hourly_rates for all
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

-- Location areas
drop policy if exists "location_areas_select_org" on public.location_areas;
create policy "location_areas_select_org"
  on public.location_areas for select
  using (
    location_id in (
      select id from public.locations
      where organization_id in (select organization_id from private.current_profile())
    )
  );

drop policy if exists "location_areas_write_manager" on public.location_areas;
create policy "location_areas_write_manager"
  on public.location_areas for all
  using (
    location_id in (
      select l.id from public.locations l
      where l.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    location_id in (
      select l.id from public.locations l
      where l.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

-- Location area staffing
drop policy if exists "location_area_staffing_select_org" on public.location_area_staffing;
create policy "location_area_staffing_select_org"
  on public.location_area_staffing for select
  using (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (select organization_id from private.current_profile())
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

-- Roles
drop policy if exists "roles_select_org" on public.roles;
create policy "roles_select_org"
  on public.roles for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

drop policy if exists "roles_write_manager" on public.roles;
create policy "roles_write_manager"
  on public.roles for all
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

-- Locations
drop policy if exists "locations_select_org" on public.locations;
create policy "locations_select_org"
  on public.locations for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

drop policy if exists "locations_write_manager" on public.locations;
create policy "locations_write_manager"
  on public.locations for all
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

-- Shift type breaks
drop policy if exists "shift_type_breaks_select_org" on public.shift_type_breaks;
create policy "shift_type_breaks_select_org"
  on public.shift_type_breaks for select
  using (
    shift_type_id in (
      select id from public.shift_types
      where organization_id in (select organization_id from private.current_profile())
    )
  );

drop policy if exists "shift_type_breaks_write_manager" on public.shift_type_breaks;
create policy "shift_type_breaks_write_manager"
  on public.shift_type_breaks for all
  using (
    shift_type_id in (
      select st.id
      from public.shift_types st
      where st.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    shift_type_id in (
      select st.id
      from public.shift_types st
      where st.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

-- Shifts
drop policy if exists "shifts_select" on public.shifts;
create policy "shifts_select"
  on public.shifts for select
  using (
    employee_id = auth.uid()
    or (
      organization_id in (select organization_id from private.current_profile())
      and private.is_manager_or_owner()
    )
  );

drop policy if exists "shifts_write_manager" on public.shifts;
create policy "shifts_write_manager"
  on public.shifts for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

drop policy if exists "shifts_update_manager" on public.shifts;
create policy "shifts_update_manager"
  on public.shifts for update
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

drop policy if exists "shifts_delete_manager" on public.shifts;
create policy "shifts_delete_manager"
  on public.shifts for delete
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

-- Availability
drop policy if exists "availability_select" on public.availability;
create policy "availability_select"
  on public.availability for select
  using (
    employee_id = auth.uid()
    or (
      organization_id in (select organization_id from private.current_profile())
      and private.is_manager_or_owner()
    )
  );

drop policy if exists "availability_insert_own" on public.availability;
create policy "availability_insert_own"
  on public.availability for insert
  with check (employee_id = auth.uid());

drop policy if exists "availability_update_own" on public.availability;
create policy "availability_update_own"
  on public.availability for update
  using (employee_id = auth.uid());

drop policy if exists "availability_delete_own" on public.availability;
create policy "availability_delete_own"
  on public.availability for delete
  using (employee_id = auth.uid());

-- Absence requests
drop policy if exists "absence_select" on public.absence_requests;
create policy "absence_select"
  on public.absence_requests for select
  using (
    employee_id = auth.uid()
    or (
      organization_id in (select organization_id from private.current_profile())
      and private.is_manager_or_owner()
    )
  );

drop policy if exists "absence_insert_own" on public.absence_requests;
create policy "absence_insert_own"
  on public.absence_requests for insert
  with check (employee_id = auth.uid());

drop policy if exists "absence_update_manager" on public.absence_requests;
create policy "absence_update_manager"
  on public.absence_requests for update
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

-- Swap requests
drop policy if exists "swap_select" on public.swap_requests;
create policy "swap_select"
  on public.swap_requests for select
  using (
    requester_id = auth.uid()
    or target_employee_id = auth.uid()
    or (
      organization_id in (select organization_id from private.current_profile())
      and private.is_manager_or_owner()
    )
  );

drop policy if exists "swap_insert_own" on public.swap_requests;
create policy "swap_insert_own"
  on public.swap_requests for insert
  with check (requester_id = auth.uid());

drop policy if exists "swap_update_manager_or_requester" on public.swap_requests;
create policy "swap_update_manager_or_requester"
  on public.swap_requests for update
  using (
    requester_id = auth.uid()
    or (
      organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

-- Coworkers view
create or replace view public.coworkers as
select id, organization_id, full_name
from public.profiles
where is_active = true;

grant select on public.coworkers to authenticated;

alter view public.coworkers set (security_invoker = true);

drop policy if exists "coworkers_via_profiles" on public.profiles;
create policy "coworkers_via_profiles"
  on public.profiles for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

