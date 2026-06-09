-- =============================================================================
-- Schichtwerk — EINZIGE SQL-DATEI IM REPOSITORY
-- =============================================================================
-- Alle Tabellen, Views, Funktionen und RLS-Policies leben hier.
-- App-Code spricht nur über @schichtwerk/database (TypeScript-Schnittstelle).
-- Bei Datenbankwechsel: Schema hier anpassen + neuen Adapter implementieren.
--
-- Ausführung: Supabase Dashboard → SQL → Run (gesamtes Skript)
-- =============================================================================

-- Enums
create type public.availability_status as enum ('available', 'unavailable', 'preferred');
create type public.absence_type as enum ('vacation', 'sick', 'other');
create type public.request_status as enum ('pending', 'approved', 'rejected', 'cancelled');

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now()
);

-- Rollen (admin / manager / basic + org-spezifische Zusatzrollen)
create table public.roles (
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

create index roles_organization_id_idx on public.roles (organization_id);

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  full_name text not null,
  email text not null,
  mobile_phone text,
  color text,
  weekly_hours numeric(5, 2),
  is_active boolean not null default true,
  schedulable boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint profiles_email_length_check check (char_length(email) <= 60),
  constraint profiles_mobile_phone_check check (
    mobile_phone is null
    or (char_length(mobile_phone) <= 20 and mobile_phone ~ '^[0-9]+$')
  )
);

create unique index profiles_organization_color_unique
  on public.profiles (organization_id, color)
  where color is not null;

create index profiles_organization_id_idx on public.profiles (organization_id);
create index profiles_organization_sort_order_idx on public.profiles (organization_id, sort_order);
create index profiles_role_id_idx on public.profiles (role_id);

-- Shift types
create table public.shift_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  color text not null default '#0D9488',
  start_time time not null,
  end_time time not null,
  sort_order int not null default 0,
  archived_at timestamptz
);

create index shift_types_organization_id_idx on public.shift_types (organization_id);

-- Qualifikationen
create table public.qualifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  archived_at timestamptz
);

create index qualifications_organization_id_idx on public.qualifications (organization_id);

-- Profil-Qualifikationen (n:m)
create table public.profile_qualifications (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, qualification_id)
);

create index profile_qualifications_profile_id_idx
  on public.profile_qualifications (profile_id);

create index profile_qualifications_qualification_id_idx
  on public.profile_qualifications (qualification_id);

-- Stundensätze pro Profil (Historie mit Gültigkeitszeitraum)
create table public.profile_hourly_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'EUR',
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint profile_hourly_rates_valid_range_check
    check (valid_to is null or valid_to >= valid_from)
);

create index profile_hourly_rates_profile_id_idx
  on public.profile_hourly_rates (profile_id);

create index profile_hourly_rates_profile_valid_from_idx
  on public.profile_hourly_rates (profile_id, valid_from desc);

create unique index profile_hourly_rates_one_open_per_profile
  on public.profile_hourly_rates (profile_id)
  where valid_to is null;

-- Wiederkehrende Verfügbarkeiten pro Profil (Wochentag + Zeitfenster)
create table public.profile_recurring_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 6),
  start_time time not null,
  end_time time not null,
  shift_type_id uuid references public.shift_types (id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint profile_recurring_availability_time_check check (start_time <> end_time)
);

create index profile_recurring_availability_profile_id_idx
  on public.profile_recurring_availability (profile_id);

create index profile_recurring_availability_profile_sort_idx
  on public.profile_recurring_availability (profile_id, sort_order);

create index profile_recurring_availability_profile_weekday_idx
  on public.profile_recurring_availability (profile_id, weekday, start_time);

-- Standorte
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  archived_at timestamptz
);

create index locations_organization_id_idx on public.locations (organization_id);

-- Bereiche pro Standort (z. B. Restaurant, BAR, Küche)
create table public.location_areas (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  archived_at timestamptz,
  unique (location_id, name)
);

create index location_areas_location_id_idx on public.location_areas (location_id);

-- Service-Zeiten pro Bereich (0=Mo … 6=So, 7=Feiertage)
create table public.location_area_service_hours (
  id uuid primary key default gen_random_uuid(),
  location_area_id uuid not null references public.location_areas (id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 7),
  start_time time not null,
  end_time time not null,
  constraint location_area_service_hours_time_order check (end_time > start_time),
  unique (location_area_id, weekday)
);

create index location_area_service_hours_area_id_idx
  on public.location_area_service_hours (location_area_id);

-- Personalbedarf: Bereich × Schichtart × Wochentag × Qualifikation (0=Mo … 6=So, 7=Feiertage)
create table public.location_area_staffing (
  id uuid primary key default gen_random_uuid(),
  location_area_id uuid not null references public.location_areas (id) on delete cascade,
  shift_type_id uuid not null references public.shift_types (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete restrict,
  weekday smallint not null check (weekday >= 0 and weekday <= 7),
  required_count int not null default 1 check (required_count >= 0),
  unique (location_area_id, shift_type_id, weekday, qualification_id)
);

create index location_area_staffing_area_id_idx
  on public.location_area_staffing (location_area_id);

create index location_area_staffing_qualification_id_idx
  on public.location_area_staffing (qualification_id);

-- Pausen pro Schichtart
create table public.shift_type_breaks (
  id uuid primary key default gen_random_uuid(),
  shift_type_id uuid not null references public.shift_types (id) on delete cascade,
  break_start time not null,
  break_end time not null,
  sort_order int not null default 0
);

create index shift_type_breaks_shift_type_id_idx
  on public.shift_type_breaks (shift_type_id);

-- Shifts
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  shift_type_id uuid references public.shift_types (id) on delete restrict,
  location_id uuid references public.locations (id) on delete restrict,
  location_area_id uuid references public.location_areas (id) on delete restrict,
  shift_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index shifts_org_date_idx on public.shifts (organization_id, shift_date);
create index shifts_location_id_idx on public.shifts (location_id);
create index shifts_location_area_id_idx on public.shifts (location_area_id);
create index shifts_employee_date_idx on public.shifts (employee_id, shift_date);

-- Availability
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  available_date date not null,
  status public.availability_status not null default 'available',
  unique (employee_id, available_date)
);

create index availability_org_idx on public.availability (organization_id);

-- Absence requests
create table public.absence_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  type public.absence_type not null,
  start_date date not null,
  end_date date not null,
  status public.request_status not null default 'pending',
  notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint absence_requests_date_range_check check (start_date <= end_date)
);

create index absence_requests_org_idx on public.absence_requests (organization_id);

-- Swap requests
create table public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  target_employee_id uuid references public.profiles (id) on delete set null,
  status public.request_status not null default 'pending',
  message text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index swap_requests_org_idx on public.swap_requests (organization_id);

-- Updated_at trigger for shifts
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

create trigger shifts_updated_at
  before update on public.shifts
  for each row execute function public.set_updated_at();

-- Referenzdatum für serverseitige Gültigkeitsprüfungen (nicht Client-Uhrzeit)
create or replace function public.current_date_iso()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select to_char(current_date, 'YYYY-MM-DD');
$$;

grant execute on function public.current_date_iso() to authenticated;
grant execute on function public.current_date_iso() to service_role;

create or replace function public.replace_location_area_staffing_for_shift_type(
  p_location_area_id uuid,
  p_shift_type_id uuid,
  p_rules jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.location_area_staffing
  where location_area_id = p_location_area_id
    and shift_type_id = p_shift_type_id;

  if p_rules is null or jsonb_array_length(p_rules) = 0 then
    return;
  end if;

  insert into public.location_area_staffing (
    location_area_id,
    shift_type_id,
    qualification_id,
    weekday,
    required_count
  )
  select
    p_location_area_id,
    p_shift_type_id,
    (r->>'qualification_id')::uuid,
    (r->>'weekday')::smallint,
    (r->>'required_count')::int
  from jsonb_array_elements(p_rules) as r
  where coalesce((r->>'required_count')::int, 0) > 0;
end;
$$;

grant execute on function public.replace_location_area_staffing_for_shift_type(uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.replace_location_area_staffing_for_shift_type(uuid, uuid, jsonb)
  to service_role;

-- RLS helpers (private schema — not exposed via PostgREST RPC)
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

-- RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.shift_types enable row level security;
alter table public.qualifications enable row level security;
alter table public.profile_qualifications enable row level security;
alter table public.profile_recurring_availability enable row level security;
alter table public.profile_hourly_rates enable row level security;
alter table public.roles enable row level security;
alter table public.locations enable row level security;
alter table public.location_areas enable row level security;
alter table public.location_area_staffing enable row level security;
alter table public.location_area_service_hours enable row level security;
alter table public.shift_type_breaks enable row level security;
alter table public.shifts enable row level security;
alter table public.availability enable row level security;
alter table public.absence_requests enable row level security;
alter table public.swap_requests enable row level security;

-- Organizations
create policy "org_select_member"
  on public.organizations for select
  using (
    id in (select organization_id from private.current_profile())
  );

create policy "org_insert_owner_signup"
  on public.organizations for insert
  with check (auth.uid() is not null);

create policy "org_update_manager"
  on public.organizations for update
  using (
    id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

-- Profiles
create policy "profiles_select_org"
  on public.profiles for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

create policy "profiles_insert_self_or_manager"
  on public.profiles for insert
  with check (
    id = auth.uid()
    or private.is_manager_or_owner()
  );

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
create policy "shift_types_select_org"
  on public.shift_types for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

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
create policy "qualifications_select_org"
  on public.qualifications for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

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
create policy "profile_qualifications_select_org"
  on public.profile_qualifications for select
  using (
    profile_id in (
      select id from public.profiles
      where organization_id in (select organization_id from private.current_profile())
    )
  );

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
create policy "profile_recurring_availability_select_org"
  on public.profile_recurring_availability for select
  using (
    profile_id in (
      select id from public.profiles
      where organization_id in (select organization_id from private.current_profile())
    )
  );

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

create policy "profile_recurring_availability_write_own"
  on public.profile_recurring_availability for insert
  with check (profile_id = auth.uid());

create policy "profile_recurring_availability_update_own"
  on public.profile_recurring_availability for update
  using (profile_id = auth.uid());

create policy "profile_recurring_availability_delete_own"
  on public.profile_recurring_availability for delete
  using (profile_id = auth.uid());

-- Profile hourly rates
create policy "profile_hourly_rates_select_org"
  on public.profile_hourly_rates for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

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
create policy "location_areas_select_org"
  on public.location_areas for select
  using (
    location_id in (
      select id from public.locations
      where organization_id in (select organization_id from private.current_profile())
    )
  );

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

-- Location area service hours
create policy "location_area_service_hours_select_org"
  on public.location_area_service_hours for select
  using (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (select organization_id from private.current_profile())
    )
  );

create policy "location_area_service_hours_write_manager"
  on public.location_area_service_hours for all
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

-- Location area staffing
create policy "location_area_staffing_select_org"
  on public.location_area_staffing for select
  using (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (select organization_id from private.current_profile())
    )
  );

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
create policy "roles_select_org"
  on public.roles for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

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
create policy "locations_select_org"
  on public.locations for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

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
create policy "shift_type_breaks_select_org"
  on public.shift_type_breaks for select
  using (
    shift_type_id in (
      select id from public.shift_types
      where organization_id in (select organization_id from private.current_profile())
    )
  );

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
create policy "shifts_select"
  on public.shifts for select
  using (
    employee_id = auth.uid()
    or (
      organization_id in (select organization_id from private.current_profile())
      and private.is_manager_or_owner()
    )
  );

create policy "shifts_write_manager"
  on public.shifts for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "shifts_update_manager"
  on public.shifts for update
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "shifts_delete_manager"
  on public.shifts for delete
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

-- Availability
create policy "availability_select"
  on public.availability for select
  using (
    employee_id = auth.uid()
    or (
      organization_id in (select organization_id from private.current_profile())
      and private.is_manager_or_owner()
    )
  );

create policy "availability_insert_own"
  on public.availability for insert
  with check (employee_id = auth.uid());

create policy "availability_update_own"
  on public.availability for update
  using (employee_id = auth.uid());

create policy "availability_delete_own"
  on public.availability for delete
  using (employee_id = auth.uid());

-- Absence requests
create policy "absence_select"
  on public.absence_requests for select
  using (
    employee_id = auth.uid()
    or (
      organization_id in (select organization_id from private.current_profile())
      and private.is_manager_or_owner()
    )
  );

create policy "absence_insert_own"
  on public.absence_requests for insert
  with check (employee_id = auth.uid());

create policy "absence_insert_manager"
  on public.absence_requests for insert
  with check (
    private.is_manager_or_owner()
    and organization_id in (select organization_id from private.current_profile())
    and exists (
      select 1
      from public.profiles p
      where p.id = employee_id
        and p.organization_id = absence_requests.organization_id
    )
  );

create policy "absence_update_manager"
  on public.absence_requests for update
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "absence_delete_manager"
  on public.absence_requests for delete
  using (
    organization_id in (select organization_id from private.current_profile())
    and private.is_manager_or_owner()
  );

-- Swap requests
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

create policy "swap_insert_own"
  on public.swap_requests for insert
  with check (requester_id = auth.uid());

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

create policy "coworkers_via_profiles"
  on public.profiles for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );
