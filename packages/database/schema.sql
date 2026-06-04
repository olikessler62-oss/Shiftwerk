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
create type public.user_role as enum ('owner', 'manager', 'employee');
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

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role public.user_role not null default 'employee',
  full_name text not null,
  email text not null,
  weekly_hours numeric(5, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index profiles_organization_id_idx on public.profiles (organization_id);

-- Shift types
create table public.shift_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  color text not null default '#0D9488',
  start_time time not null,
  end_time time not null,
  sort_order int not null default 0
);

create index shift_types_organization_id_idx on public.shift_types (organization_id);

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
  shift_type_id uuid not null references public.shift_types (id) on delete restrict,
  shift_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index shifts_org_date_idx on public.shifts (organization_id, shift_date);
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
  created_at timestamptz not null default now()
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
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger shifts_updated_at
  before update on public.shifts
  for each row execute function public.set_updated_at();

-- Helper: current user's org + role
create or replace function public.current_profile()
returns table (organization_id uuid, role public.user_role)
language sql
stable
security definer
set search_path = public
as $$
  select p.organization_id, p.role
  from public.profiles p
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
    where cp.role in ('owner', 'manager')
  );
$$;

-- RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.shift_types enable row level security;
alter table public.shift_type_breaks enable row level security;
alter table public.shifts enable row level security;
alter table public.availability enable row level security;
alter table public.absence_requests enable row level security;
alter table public.swap_requests enable row level security;

-- Organizations
create policy "org_select_member"
  on public.organizations for select
  using (
    id in (select organization_id from public.current_profile())
  );

create policy "org_insert_owner_signup"
  on public.organizations for insert
  with check (auth.uid() is not null);

create policy "org_update_manager"
  on public.organizations for update
  using (
    id in (
      select organization_id from public.current_profile()
      where role in ('owner', 'manager')
    )
  );

-- Profiles
create policy "profiles_select_org"
  on public.profiles for select
  using (
    organization_id in (select organization_id from public.current_profile())
  );

create policy "profiles_insert_self_or_manager"
  on public.profiles for insert
  with check (
    id = auth.uid()
    or public.is_manager_or_owner()
  );

create policy "profiles_update_manager_or_self"
  on public.profiles for update
  using (
    id = auth.uid()
    or (
      organization_id in (select organization_id from public.current_profile())
      and public.is_manager_or_owner()
    )
  );

-- Shift types
create policy "shift_types_select_org"
  on public.shift_types for select
  using (
    organization_id in (select organization_id from public.current_profile())
  );

create policy "shift_types_write_manager"
  on public.shift_types for all
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where role in ('owner', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from public.current_profile()
      where role in ('owner', 'manager')
    )
  );

-- Shift type breaks
create policy "shift_type_breaks_select_org"
  on public.shift_type_breaks for select
  using (
    shift_type_id in (
      select id from public.shift_types
      where organization_id in (select organization_id from public.current_profile())
    )
  );

create policy "shift_type_breaks_write_manager"
  on public.shift_type_breaks for all
  using (
    shift_type_id in (
      select st.id
      from public.shift_types st
      where st.organization_id in (
        select organization_id from public.current_profile()
        where role in ('owner', 'manager')
      )
    )
  )
  with check (
    shift_type_id in (
      select st.id
      from public.shift_types st
      where st.organization_id in (
        select organization_id from public.current_profile()
        where role in ('owner', 'manager')
      )
    )
  );

-- Shifts
create policy "shifts_select"
  on public.shifts for select
  using (
    employee_id = auth.uid()
    or (
      organization_id in (select organization_id from public.current_profile())
      and public.is_manager_or_owner()
    )
  );

create policy "shifts_write_manager"
  on public.shifts for insert
  with check (
    organization_id in (
      select organization_id from public.current_profile()
      where role in ('owner', 'manager')
    )
  );

create policy "shifts_update_manager"
  on public.shifts for update
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where role in ('owner', 'manager')
    )
  );

create policy "shifts_delete_manager"
  on public.shifts for delete
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where role in ('owner', 'manager')
    )
  );

-- Availability
create policy "availability_select"
  on public.availability for select
  using (
    employee_id = auth.uid()
    or (
      organization_id in (select organization_id from public.current_profile())
      and public.is_manager_or_owner()
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
      organization_id in (select organization_id from public.current_profile())
      and public.is_manager_or_owner()
    )
  );

create policy "absence_insert_own"
  on public.absence_requests for insert
  with check (employee_id = auth.uid());

create policy "absence_update_manager"
  on public.absence_requests for update
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where role in ('owner', 'manager')
    )
  );

-- Swap requests
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

create policy "swap_insert_own"
  on public.swap_requests for insert
  with check (requester_id = auth.uid());

create policy "swap_update_manager_or_requester"
  on public.swap_requests for update
  using (
    requester_id = auth.uid()
    or (
      organization_id in (
        select organization_id from public.current_profile()
        where role in ('owner', 'manager')
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
    organization_id in (select organization_id from public.current_profile())
  );
