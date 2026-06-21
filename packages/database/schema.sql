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
create type public.absence_type as enum ('vacation', 'sick', 'other');
create type public.request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.shift_confirmation_status as enum (
  'proposed',
  'requested',
  'confirmed',
  'rejected',
  'pending',
  'canceled'
);

create type public.shift_lifecycle_status as enum (
  'planned',
  'confirmed',
  'cancelled'
);

create type public.shift_request_type as enum (
  'confirmation',
  'cancellation'
);

create type public.shift_request_status as enum (
  'pending',
  'approved',
  'rejected',
  'expired',
  'cancelled'
);

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Berlin',
  country_code char(2) not null default 'DE',
  planning_mode text not null default 'simple'
    check (planning_mode in ('simple', 'advanced')),
  industry text
    check (industry is null or industry in ('gastronomy', 'care', 'retail', 'other')),
  allow_retroactive_compensation_entries boolean not null default true,
  shift_confirmation_enabled boolean not null default false,
  shift_confirmation_disclaimer text,
  auto_approve_sick_absence boolean not null default true,
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
  app_registered_at timestamptz,
  email_fallback_mode boolean not null default false,
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

-- Sonderzuschläge (Organisations-Katalog)
create table public.compensation_surcharge_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  trigger text not null check (trigger in ('public_holiday', 'sunday')),
  amount numeric(10, 2) not null check (amount >= 0),
  unit text not null check (unit in ('eur_per_hour', 'percent_of_base')),
  sort_order int not null default 0,
  archived_at timestamptz
);

create index compensation_surcharge_types_organization_id_idx
  on public.compensation_surcharge_types (organization_id);

-- Profil-Sonderzuschläge (Historie mit Gültigkeitszeitraum)
create table public.profile_compensation_surcharges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  surcharge_type_id uuid not null references public.compensation_surcharge_types (id) on delete restrict,
  amount numeric(10, 2) check (amount is null or amount >= 0),
  unit text check (unit is null or unit in ('eur_per_hour', 'percent_of_base')),
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint profile_compensation_surcharges_valid_range_check
    check (valid_to is null or valid_to >= valid_from)
);

create index profile_compensation_surcharges_profile_id_idx
  on public.profile_compensation_surcharges (profile_id);

create index profile_compensation_surcharges_profile_type_valid_from_idx
  on public.profile_compensation_surcharges (profile_id, surcharge_type_id, valid_from desc);

create unique index profile_compensation_surcharges_one_open_per_type
  on public.profile_compensation_surcharges (profile_id, surcharge_type_id)
  where valid_to is null;

-- Wiederkehrende Verfügbarkeiten pro Profil (Wochentag + Zeitfenster)
create table public.profile_recurring_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 7),
  start_time time not null,
  end_time time not null,
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

-- Wünsche pro Profil (Priorisierung bei Schichtzuweisung; Zeit optional)
create table public.profile_shift_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint check (weekday >= 0 and weekday <= 7),
  start_time time,
  end_time time,
  location_id uuid references public.locations (id) on delete set null,
  location_area_id uuid references public.location_areas (id) on delete set null,
  qualification_id uuid references public.qualifications (id) on delete set null,
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_shift_preferences_time_pair_check check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and start_time <> end_time)
  ),
  constraint profile_shift_preferences_weekday_time_check check (
    (weekday is null) = (start_time is null and end_time is null)
  ),
  constraint profile_shift_preferences_dimension_check check (
    (weekday is not null and start_time is not null and end_time is not null)
    or location_id is not null
    or location_area_id is not null
    or qualification_id is not null
  )
);

create index profile_shift_preferences_org_profile_weekday_idx
  on public.profile_shift_preferences (organization_id, profile_id, weekday);

create index profile_shift_preferences_area_idx
  on public.profile_shift_preferences (location_area_id)
  where location_area_id is not null;

create index profile_shift_preferences_location_idx
  on public.profile_shift_preferences (location_id)
  where location_id is not null;

create index profile_shift_preferences_qualification_idx
  on public.profile_shift_preferences (qualification_id)
  where qualification_id is not null;

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
  planning_mode text not null default 'simple'
    check (planning_mode in ('simple', 'advanced')),
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
  constraint location_area_service_hours_time_order check (start_time <> end_time)
);

create index location_area_service_hours_area_id_idx
  on public.location_area_service_hours (location_area_id);

create index location_area_service_hours_area_weekday_start_idx
  on public.location_area_service_hours (location_area_id, weekday, start_time);

-- Personalbedarf: Bereich × Servicezeit-Fenster × Qualifikation
create table public.location_area_staffing (
  id uuid primary key default gen_random_uuid(),
  location_area_id uuid not null references public.location_areas (id) on delete cascade,
  service_hour_id uuid not null references public.location_area_service_hours (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete restrict,
  required_count int not null default 1 check (required_count >= 0),
  unique (service_hour_id, qualification_id)
);

create index location_area_staffing_area_id_idx
  on public.location_area_staffing (location_area_id);

create index location_area_staffing_service_hour_id_idx
  on public.location_area_staffing (service_hour_id);

create index location_area_staffing_qualification_id_idx
  on public.location_area_staffing (qualification_id);

-- Temporärer Personalbedarf pro Kalenderdatum
create table public.location_area_staffing_overrides (
  id uuid primary key default gen_random_uuid(),
  location_area_id uuid not null references public.location_areas (id) on delete cascade,
  shift_date date not null,
  service_hour_id uuid not null references public.location_area_service_hours (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete restrict,
  required_count int not null check (required_count >= 0),
  unique (location_area_id, shift_date, service_hour_id, qualification_id)
);

create index location_area_staffing_overrides_area_date_idx
  on public.location_area_staffing_overrides (location_area_id, shift_date);

-- Schichtvorlagen pro Bereich (optional, nur Zuweisungs-Kurzwahl)
create table public.area_shift_templates (
  id uuid primary key default gen_random_uuid(),
  location_area_id uuid not null references public.location_areas (id) on delete cascade,
  name text not null,
  color text not null default '#0D9488',
  start_time time not null,
  end_time time not null,
  sort_order int not null default 0,
  archived_at timestamptz
);

create unique index area_shift_templates_location_area_id_name_active_key
  on public.area_shift_templates (location_area_id, name)
  where archived_at is null;

create index area_shift_templates_location_area_id_idx
  on public.area_shift_templates (location_area_id);

create table public.area_shift_template_breaks (
  id uuid primary key default gen_random_uuid(),
  area_shift_template_id uuid not null references public.area_shift_templates (id) on delete cascade,
  break_start time not null,
  break_end time not null,
  sort_order int not null default 0
);

create index area_shift_template_breaks_template_id_idx
  on public.area_shift_template_breaks (area_shift_template_id);

-- Funktionsvorlagen pro Bereich
create table public.area_qualification_templates (
  id uuid primary key default gen_random_uuid(),
  location_area_id uuid not null references public.location_areas (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete restrict,
  sort_order int not null default 0,
  unique (location_area_id, qualification_id)
);

create index area_qualification_templates_location_area_id_idx
  on public.area_qualification_templates (location_area_id);

create index area_qualification_templates_qualification_id_idx
  on public.area_qualification_templates (qualification_id);

-- Shifts
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  area_shift_template_id uuid references public.area_shift_templates (id) on delete set null,
  location_id uuid references public.locations (id) on delete restrict,
  location_area_id uuid references public.location_areas (id) on delete restrict,
  shift_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  confirmation_status public.shift_confirmation_status not null default 'confirmed',
  confirmation_status_updated_at timestamptz not null default now(),
  lifecycle_status public.shift_lifecycle_status not null default 'confirmed',
  requested_at timestamptz,
  pending_since timestamptz,
  pending_reminder_sent_at timestamptz,
  employee_dismissed_at timestamptz
);

create index shifts_area_shift_template_id_idx on public.shifts (area_shift_template_id);

create index shifts_org_date_idx on public.shifts (organization_id, shift_date);
create index shifts_org_location_date_idx on public.shifts (organization_id, location_id, shift_date);
create index shifts_location_id_idx on public.shifts (location_id);
create index shifts_location_area_id_idx on public.shifts (location_area_id);
create index shifts_employee_date_idx on public.shifts (employee_id, shift_date);
create index shifts_confirmation_status_idx
  on public.shifts (organization_id, confirmation_status, shift_date);

create index shifts_lifecycle_status_idx
  on public.shifts (organization_id, lifecycle_status, shift_date);

create index shifts_employee_dismissed_at_idx
  on public.shifts (employee_id, employee_dismissed_at)
  where employee_dismissed_at is null;

create or replace function public.count_shifts_conflicting_with_absence_ranges(
  p_organization_id uuid,
  p_ranges jsonb
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.shifts s
  where s.organization_id = p_organization_id
    and exists (
      select 1
      from jsonb_to_recordset(p_ranges) as r(
        employee_id uuid,
        start_date date,
        end_date date
      )
      where s.employee_id = r.employee_id
        and s.shift_date >= r.start_date
        and s.shift_date <= r.end_date
    );
$$;

grant execute on function public.count_shifts_conflicting_with_absence_ranges(uuid, jsonb)
  to authenticated;

-- Archiv (Phase 2, Spec 006) — kein Client-Lesezugriff
create table public.shifts_archive (
  id uuid primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  area_shift_template_id uuid references public.area_shift_templates (id) on delete set null,
  location_id uuid references public.locations (id) on delete restrict,
  location_area_id uuid references public.location_areas (id) on delete restrict,
  shift_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null,
  archived_at timestamptz not null default now()
);

create index shifts_archive_org_date_idx
  on public.shifts_archive (organization_id, shift_date);

create index shifts_archive_org_location_date_idx
  on public.shifts_archive (organization_id, location_id, shift_date);

create index shifts_archive_employee_date_idx
  on public.shifts_archive (employee_id, shift_date);

alter table public.shifts_archive enable row level security;

create policy "shifts_archive_deny_clients"
  on public.shifts_archive for all
  to authenticated
  using (false)
  with check (false);

create table if not exists public.organization_superadmin_shift_snapshots (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  shifts jsonb not null default '[]'::jsonb,
  saved_at timestamptz not null default now()
);

alter table public.organization_superadmin_shift_snapshots enable row level security;

create policy "organization_superadmin_shift_snapshots_deny_clients"
  on public.organization_superadmin_shift_snapshots for all
  to authenticated
  using (false)
  with check (false);

create table if not exists private.shift_retention_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('archive', 'purge')),
  cutoff_date date not null,
  processed_count bigint not null default 0,
  cancelled_swaps bigint,
  duration_ms int not null,
  created_at timestamptz not null default now()
);

create or replace function public.cancel_pending_swaps_before_shift_archive(
  p_hot_cutoff date
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  update public.swap_requests sr
  set status = 'cancelled'
  from public.shifts s
  where sr.shift_id = s.id
    and sr.status = 'pending'
    and s.shift_date < p_hot_cutoff;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.archive_shifts_batch(
  p_hot_cutoff date,
  p_batch_size int default 5000
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archived bigint;
begin
  with batch as (
    select id
    from public.shifts
    where shift_date < p_hot_cutoff
    order by shift_date
    limit p_batch_size
    for update skip locked
  ),
  ins as (
    insert into public.shifts_archive (
      id,
      organization_id,
      employee_id,
      area_shift_template_id,
      location_id,
      location_area_id,
      shift_date,
      starts_at,
      ends_at,
      notes,
      created_by,
      updated_at
    )
    select
      s.id,
      s.organization_id,
      s.employee_id,
      s.area_shift_template_id,
      s.location_id,
      s.location_area_id,
      s.shift_date,
      s.starts_at,
      s.ends_at,
      s.notes,
      s.created_by,
      s.updated_at
    from public.shifts s
    inner join batch b on b.id = s.id
    on conflict (id) do nothing
    returning id
  )
  delete from public.shifts s
  using batch b
  where s.id = b.id;

  get diagnostics v_archived = row_count;
  return v_archived;
end;
$$;

create or replace function public.purge_shifts_archive_batch(
  p_purge_cutoff date,
  p_batch_size int default 5000
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purged bigint;
begin
  with batch as (
    select id
    from public.shifts_archive
    where shift_date < p_purge_cutoff
    order by shift_date
    limit p_batch_size
    for update skip locked
  )
  delete from public.shifts_archive a
  using batch b
  where a.id = b.id;

  get diagnostics v_purged = row_count;
  return v_purged;
end;
$$;

create or replace function public.purge_expired_absence_requests_batch(
  p_purge_cutoff date,
  p_batch_size int default 1000
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purged bigint;
begin
  with batch as (
    select id
    from public.absence_requests
    where end_date is not null
      and end_date < p_purge_cutoff
    order by end_date
    limit p_batch_size
    for update skip locked
  )
  delete from public.absence_requests a
  using batch b
  where a.id = b.id;

  get diagnostics v_purged = row_count;
  return v_purged;
end;
$$;

create or replace function public.log_shift_retention_run(
  p_job_type text,
  p_cutoff_date date,
  p_processed_count bigint,
  p_cancelled_swaps bigint,
  p_duration_ms int
)
returns void
language sql
security definer
set search_path = public, private
as $$
  insert into private.shift_retention_runs (
    job_type,
    cutoff_date,
    processed_count,
    cancelled_swaps,
    duration_ms
  )
  values (
    p_job_type,
    p_cutoff_date,
    p_processed_count,
    p_cancelled_swaps,
    p_duration_ms
  );
$$;

revoke all on function public.cancel_pending_swaps_before_shift_archive(date) from public;
revoke all on function public.archive_shifts_batch(date, int) from public;
revoke all on function public.purge_shifts_archive_batch(date, int) from public;
revoke all on function public.purge_expired_absence_requests_batch(date, int) from public;
revoke all on function public.log_shift_retention_run(text, date, bigint, bigint, int) from public;

grant execute on function public.cancel_pending_swaps_before_shift_archive(date) to service_role;
grant execute on function public.archive_shifts_batch(date, int) to service_role;
grant execute on function public.purge_shifts_archive_batch(date, int) to service_role;
grant execute on function public.purge_expired_absence_requests_batch(date, int) to service_role;
grant execute on function public.log_shift_retention_run(text, date, bigint, bigint, int) to service_role;

grant all on table private.shift_retention_runs to service_role;

-- Absence requests
create table public.absence_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  type public.absence_type not null,
  start_date date not null,
  end_date date,
  is_open_ended boolean not null default false,
  expected_end_date date,
  status public.request_status not null default 'pending',
  notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reported_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint absence_requests_date_range_check check (
    (is_open_ended = true and end_date is null)
    or (is_open_ended = false and end_date is not null and start_date <= end_date)
  ),
  constraint absence_requests_open_ended_sick_only check (
    is_open_ended = false or type = 'sick'
  )
);

create index absence_requests_org_idx on public.absence_requests (organization_id);

create trigger absence_requests_updated_at
  before update on public.absence_requests
  for each row execute function public.set_updated_at();

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

-- Shift confirmation (Spec 008)
create table public.shift_confirmation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  from_status public.shift_confirmation_status,
  to_status public.shift_confirmation_status not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index shift_confirmation_events_shift_idx
  on public.shift_confirmation_events (shift_id, created_at desc);

create table public.shift_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  type public.shift_request_type not null,
  status public.shift_request_status not null default 'pending',
  actor_id uuid references public.profiles (id) on delete set null,
  sent_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz,
  reminder_sent_at timestamptz,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shift_requests_org_type_status_idx
  on public.shift_requests (organization_id, type, status);

create index shift_requests_shift_created_idx
  on public.shift_requests (shift_id, created_at desc);

create unique index shift_requests_open_confirmation_idx
  on public.shift_requests (shift_id)
  where type = 'confirmation' and status in ('pending', 'expired');

create or replace view public.shifts_with_legacy_confirmation as
select
  s.*,
  case
    when s.lifecycle_status = 'cancelled'::public.shift_lifecycle_status then 'canceled'
    when s.lifecycle_status = 'confirmed'::public.shift_lifecycle_status then 'confirmed'
    when cr.status = 'pending'::public.shift_request_status then 'requested'
    when cr.status = 'expired'::public.shift_request_status then 'pending'
    when cr.status = 'rejected'::public.shift_request_status then 'rejected'
    else 'proposed'
  end as confirmation_status_legacy
from public.shifts s
left join lateral (
  select sr.status
  from public.shift_requests sr
  where sr.shift_id = s.id
    and sr.type = 'confirmation'
  order by sr.created_at desc
  limit 1
) cr on true;

create table public.shift_deletion_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shift_id uuid not null,
  deleted_by uuid not null references public.profiles (id) on delete restrict,
  deleted_at timestamptz not null default now(),
  snapshot jsonb not null
);

create index shift_deletion_events_org_deleted_at_idx
  on public.shift_deletion_events (organization_id, deleted_at desc);

create index shift_deletion_events_shift_id_idx
  on public.shift_deletion_events (shift_id);

create table public.confirmation_request_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  sent_by uuid not null references public.profiles (id) on delete restrict,
  scope text not null check (scope in (
    'single_shift', 'employee_day', 'employee_week', 'bulk_week'
  )),
  week_start date not null,
  week_end date not null,
  is_delta boolean not null default false,
  sent_at timestamptz not null default now()
);

create index confirmation_request_batches_employee_week_idx
  on public.confirmation_request_batches (employee_id, week_start, week_end);

create table public.confirmation_request_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.confirmation_request_batches (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (batch_id, shift_id)
);

create index confirmation_request_items_shift_idx
  on public.confirmation_request_items (shift_id, created_at desc);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('push', 'email')),
  template_key text not null,
  payload jsonb not null default '{}',
  simulated boolean not null default true,
  created_at timestamptz not null default now()
);

create index notification_outbox_org_created_idx
  on public.notification_outbox (organization_id, created_at desc);

create table public.manager_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index manager_notifications_recipient_idx
  on public.manager_notifications (recipient_profile_id, created_at desc)
  where dismissed_at is null;

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

create trigger shift_requests_updated_at
  before update on public.shift_requests
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

create or replace function public.reset_organization_operational_data(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area_ids uuid[];
begin
  if not exists (
    select 1 from public.organizations where id = p_organization_id
  ) then
    raise exception 'organization not found';
  end if;

  select coalesce(array_agg(la.id), '{}'::uuid[])
  into v_area_ids
  from public.location_areas la
  inner join public.locations l on l.id = la.location_id
  where l.organization_id = p_organization_id;

  delete from public.confirmation_request_items
  where batch_id in (
    select id from public.confirmation_request_batches
    where organization_id = p_organization_id
  );

  delete from public.confirmation_request_batches
  where organization_id = p_organization_id;

  delete from public.shift_confirmation_events
  where organization_id = p_organization_id;

  delete from public.shift_deletion_events
  where organization_id = p_organization_id;

  delete from public.notification_outbox
  where organization_id = p_organization_id;

  delete from public.manager_notifications
  where organization_id = p_organization_id;

  delete from public.swap_requests
  where organization_id = p_organization_id;

  delete from public.absence_requests
  where organization_id = p_organization_id;

  delete from public.shifts
  where organization_id = p_organization_id;

  delete from public.shifts_archive
  where organization_id = p_organization_id;

  if coalesce(array_length(v_area_ids, 1), 0) > 0 then
    delete from public.location_area_staffing
    where location_area_id = any (v_area_ids);

    delete from public.location_area_service_hours
    where location_area_id = any (v_area_ids);

    delete from public.area_shift_template_breaks
    where area_shift_template_id in (
      select id from public.area_shift_templates
      where location_area_id = any (v_area_ids)
    );

    delete from public.area_shift_templates
    where location_area_id = any (v_area_ids);

    delete from public.area_qualification_templates
    where location_area_id = any (v_area_ids);

    delete from public.location_areas
    where id = any (v_area_ids);
  end if;

  delete from public.profile_shift_preferences
  where organization_id = p_organization_id;

  delete from public.profile_recurring_availability
  where organization_id = p_organization_id;

  delete from public.profile_compensation_surcharges
  where organization_id = p_organization_id;

  delete from public.profile_qualifications
  where profile_id in (
    select id from public.profiles where organization_id = p_organization_id
  );

  delete from public.profile_hourly_rates
  where organization_id = p_organization_id;

  delete from public.compensation_surcharge_types
  where organization_id = p_organization_id;

  delete from public.profiles
  where organization_id = p_organization_id;
end;
$$;

grant execute on function public.reset_organization_operational_data(uuid) to service_role;

create or replace function public.reset_organization_shift_data(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kellner_id uuid;
  v_koch_id uuid;
  v_barista_id uuid;
  v_spuel_id uuid;
  v_next_qual_sort int;
begin
  if not exists (
    select 1 from public.organizations where id = p_organization_id
  ) then
    raise exception 'organization not found';
  end if;

  delete from public.confirmation_request_items
  where batch_id in (
    select id from public.confirmation_request_batches
    where organization_id = p_organization_id
  );

  delete from public.confirmation_request_batches
  where organization_id = p_organization_id;

  delete from public.shift_requests
  where organization_id = p_organization_id;

  delete from public.shift_confirmation_events
  where organization_id = p_organization_id;

  delete from public.shift_deletion_events
  where organization_id = p_organization_id;

  delete from public.swap_requests
  where organization_id = p_organization_id;

  delete from public.notification_outbox
  where organization_id = p_organization_id;

  delete from public.manager_notifications
  where organization_id = p_organization_id;

  delete from public.shifts
  where organization_id = p_organization_id;

  delete from public.shifts_archive
  where organization_id = p_organization_id;

  delete from public.location_area_staffing_overrides
  where location_area_id in (
    select la.id
    from public.location_areas la
    inner join public.locations l on l.id = la.location_id
    where l.organization_id = p_organization_id
  );

  delete from public.profile_recurring_availability
  where organization_id = p_organization_id;

  insert into public.profile_recurring_availability (
    organization_id,
    profile_id,
    weekday,
    start_time,
    end_time,
    sort_order
  )
  select
    p.organization_id,
    p.id,
    wd.weekday,
    time '07:00',
    time '22:00',
    wd.weekday
  from public.profiles p
  cross join generate_series(0, 6) as wd(weekday)
  where p.organization_id = p_organization_id;

  delete from public.location_area_service_hours
  where location_area_id in (
    select la.id
    from public.location_areas la
    inner join public.locations l on l.id = la.location_id
    where l.organization_id = p_organization_id
      and lower(la.name) in ('restaurant', 'küche', 'bar')
  );

  insert into public.location_area_service_hours (
    location_area_id,
    weekday,
    start_time,
    end_time
  )
  select
    la.id,
    wd.weekday,
    slot.start_time,
    slot.end_time
  from public.location_areas la
  inner join public.locations l on l.id = la.location_id
  cross join unnest(array[0, 1, 2, 4, 5, 6]) as wd(weekday)
  cross join (
    values
      (time '07:00', time '10:00'),
      (time '12:00', time '15:00'),
      (time '18:00', time '22:00')
  ) as slot(start_time, end_time)
  where l.organization_id = p_organization_id
    and lower(la.name) in ('restaurant', 'küche');

  insert into public.location_area_service_hours (
    location_area_id,
    weekday,
    start_time,
    end_time
  )
  select
    la.id,
    wd.weekday,
    time '18:00',
    time '22:00'
  from public.location_areas la
  inner join public.locations l on l.id = la.location_id
  cross join unnest(array[0, 1, 2, 4, 5, 6]) as wd(weekday)
  where l.organization_id = p_organization_id
    and lower(la.name) = 'bar';

  select id into v_kellner_id
  from public.qualifications
  where organization_id = p_organization_id
    and name = 'Kellner/in'
    and archived_at is null
  limit 1;

  if v_kellner_id is null then
    raise exception 'qualification not found: Kellner/in';
  end if;

  select id into v_koch_id
  from public.qualifications
  where organization_id = p_organization_id
    and name = 'Koch/Köchin'
    and archived_at is null
  limit 1;

  if v_koch_id is null then
    raise exception 'qualification not found: Koch/Köchin';
  end if;

  select id into v_spuel_id
  from public.qualifications
  where organization_id = p_organization_id
    and name = 'Spülkraft'
    and archived_at is null
  limit 1;

  if v_spuel_id is null then
    raise exception 'qualification not found: Spülkraft';
  end if;

  select id into v_barista_id
  from public.qualifications
  where organization_id = p_organization_id
    and name = 'Barista'
    and archived_at is null
  limit 1;

  if v_barista_id is null then
    select coalesce(max(sort_order), -1) + 1
    into v_next_qual_sort
    from public.qualifications
    where organization_id = p_organization_id;

    insert into public.qualifications (organization_id, name, sort_order)
    values (p_organization_id, 'Barista', v_next_qual_sort)
    returning id into v_barista_id;
  end if;

  delete from public.profile_qualifications
  where profile_id in (
    select id from public.profiles where organization_id = p_organization_id
  );

  insert into public.profile_qualifications (profile_id, qualification_id)
  select p.id, v_kellner_id
  from public.profiles p
  where p.organization_id = p_organization_id;

  insert into public.profile_qualifications (profile_id, qualification_id)
  select ranked.profile_id, v_koch_id
  from (
    select
      p.id as profile_id,
      row_number() over (
        order by p.sort_order, p.full_name, p.created_at, p.id
      ) as rn
    from public.profiles p
    where p.organization_id = p_organization_id
  ) ranked
  where ranked.rn <= 7;

  insert into public.profile_qualifications (profile_id, qualification_id)
  select ranked.profile_id, v_barista_id
  from (
    select
      p.id as profile_id,
      row_number() over (
        order by p.sort_order, p.full_name, p.created_at, p.id
      ) as rn,
      count(*) over () as total_count
    from public.profiles p
    where p.organization_id = p_organization_id
  ) ranked
  where ranked.rn > ranked.total_count - 7;

  insert into public.profile_qualifications (profile_id, qualification_id)
  select ranked.profile_id, v_spuel_id
  from (
    select
      p.id as profile_id,
      row_number() over (
        order by p.sort_order, p.full_name, p.created_at, p.id
      ) as rn
    from public.profiles p
    where p.organization_id = p_organization_id
  ) ranked
  where ranked.rn >= 7
    and ranked.rn <= 13;

  delete from public.profile_hourly_rates
  where organization_id = p_organization_id;

  insert into public.profile_hourly_rates (
    organization_id,
    profile_id,
    amount,
    currency,
    valid_from,
    valid_to
  )
  select
    p.organization_id,
    p.id,
    15.60,
    'EUR',
    date '2020-01-01',
    null
  from public.profiles p
  where p.organization_id = p_organization_id;

  update public.profiles
  set weekly_hours = 40
  where organization_id = p_organization_id;

  delete from public.location_area_staffing
  where location_area_id in (
    select la.id
    from public.location_areas la
    inner join public.locations l on l.id = la.location_id
    where l.organization_id = p_organization_id
      and lower(la.name) in ('restaurant', 'küche', 'bar')
  );

  insert into public.location_area_staffing (
    location_area_id,
    service_hour_id,
    qualification_id,
    required_count
  )
  select
    lash.location_area_id,
    lash.id,
    q.id,
    rule.required_count
  from public.location_area_service_hours lash
  inner join public.location_areas la on la.id = lash.location_area_id
  inner join public.locations loc on loc.id = la.location_id
  inner join (
    values
      ('restaurant', time '07:00', time '10:00', 'Kellner/in', 2),
      ('restaurant', time '12:00', time '15:00', 'Kellner/in', 2),
      ('restaurant', time '18:00', time '22:00', 'Kellner/in', 2),
      ('küche', time '07:00', time '10:00', 'Koch/Köchin', 1),
      ('küche', time '12:00', time '15:00', 'Koch/Köchin', 1),
      ('küche', time '12:00', time '15:00', 'Spülkraft', 1),
      ('küche', time '18:00', time '22:00', 'Koch/Köchin', 1),
      ('küche', time '18:00', time '22:00', 'Spülkraft', 1),
      ('bar', time '18:00', time '22:00', 'Barista', 1),
      ('bar', time '18:00', time '22:00', 'Spülkraft', 1)
  ) as rule(area_key, start_time, end_time, qual_name, required_count)
    on lower(la.name) = rule.area_key
   and lash.start_time = rule.start_time
   and lash.end_time = rule.end_time
  inner join public.qualifications q
    on q.organization_id = loc.organization_id
   and q.name = rule.qual_name
   and q.archived_at is null
  where loc.organization_id = p_organization_id
    and lash.weekday = any (array[0, 1, 2, 4, 5, 6]);
end;
$$;

grant execute on function public.reset_organization_shift_data(uuid) to service_role;

create or replace function public.save_organization_shift_snapshot(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shifts jsonb;
  v_count integer;
begin
  if not exists (
    select 1 from public.organizations where id = p_organization_id
  ) then
    raise exception 'organization not found';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'employee_id', s.employee_id,
          'area_shift_template_id', s.area_shift_template_id,
          'location_id', s.location_id,
          'location_area_id', s.location_area_id,
          'shift_date', s.shift_date,
          'starts_at', s.starts_at,
          'ends_at', s.ends_at,
          'notes', s.notes,
          'confirmation_status', s.confirmation_status,
          'confirmation_status_updated_at', s.confirmation_status_updated_at,
          'lifecycle_status', s.lifecycle_status,
          'requested_at', s.requested_at,
          'pending_since', s.pending_since,
          'pending_reminder_sent_at', s.pending_reminder_sent_at,
          'employee_dismissed_at', s.employee_dismissed_at
        )
        order by s.shift_date, s.starts_at
      ),
      '[]'::jsonb
    ),
    count(*)::integer
  into v_shifts, v_count
  from public.shifts s
  where s.organization_id = p_organization_id;

  insert into public.organization_superadmin_shift_snapshots (
    organization_id,
    shifts,
    saved_at
  )
  values (p_organization_id, v_shifts, now())
  on conflict (organization_id) do update
  set shifts = excluded.shifts,
      saved_at = excluded.saved_at;

  return v_count;
end;
$$;

create or replace function public.restore_organization_shift_snapshot(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with snapshot as (
    select shifts
    from public.organization_superadmin_shift_snapshots
    where organization_id = p_organization_id
  ),
  inserted as (
    insert into public.shifts (
      organization_id,
      employee_id,
      area_shift_template_id,
      location_id,
      location_area_id,
      shift_date,
      starts_at,
      ends_at,
      notes,
      confirmation_status,
      confirmation_status_updated_at,
      lifecycle_status,
      requested_at,
      pending_since,
      pending_reminder_sent_at,
      employee_dismissed_at
    )
    select
      p_organization_id,
      (elem->>'employee_id')::uuid,
      (elem->>'area_shift_template_id')::uuid,
      (elem->>'location_id')::uuid,
      (elem->>'location_area_id')::uuid,
      (elem->>'shift_date')::date,
      (elem->>'starts_at')::timestamptz,
      (elem->>'ends_at')::timestamptz,
      elem->>'notes',
      (elem->>'confirmation_status')::public.shift_confirmation_status,
      coalesce(
        (elem->>'confirmation_status_updated_at')::timestamptz,
        now()
      ),
      coalesce(
        (elem->>'lifecycle_status')::public.shift_lifecycle_status,
        'confirmed'::public.shift_lifecycle_status
      ),
      (elem->>'requested_at')::timestamptz,
      (elem->>'pending_since')::timestamptz,
      (elem->>'pending_reminder_sent_at')::timestamptz,
      (elem->>'employee_dismissed_at')::timestamptz
    from snapshot
    cross join lateral jsonb_array_elements(snapshot.shifts) as elem
    where jsonb_array_length(snapshot.shifts) > 0
    returning 1
  )
  select count(*)::integer into v_count from inserted;

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.save_organization_shift_snapshot(uuid) to service_role;
grant execute on function public.restore_organization_shift_snapshot(uuid) to service_role;

create or replace function public.replace_location_area_staffing_for_service_hour(
  p_service_hour_id uuid,
  p_rules jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.location_area_staffing
  where service_hour_id = p_service_hour_id;

  if p_rules is null or jsonb_array_length(p_rules) = 0 then
    return;
  end if;

  insert into public.location_area_staffing (
    location_area_id,
    service_hour_id,
    qualification_id,
    required_count
  )
  select
    lash.location_area_id,
    p_service_hour_id,
    (r->>'qualification_id')::uuid,
    (r->>'required_count')::int
  from jsonb_array_elements(p_rules) as r
  join public.location_area_service_hours lash on lash.id = p_service_hour_id
  where coalesce((r->>'required_count')::int, 0) > 0;
end;
$$;

grant execute on function public.replace_location_area_staffing_for_service_hour(uuid, jsonb)
  to authenticated;
grant execute on function public.replace_location_area_staffing_for_service_hour(uuid, jsonb)
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
alter table public.qualifications enable row level security;
alter table public.profile_qualifications enable row level security;
alter table public.profile_recurring_availability enable row level security;
alter table public.profile_shift_preferences enable row level security;
alter table public.profile_hourly_rates enable row level security;
alter table public.compensation_surcharge_types enable row level security;
alter table public.profile_compensation_surcharges enable row level security;
alter table public.roles enable row level security;
alter table public.locations enable row level security;
alter table public.location_areas enable row level security;
alter table public.location_area_staffing enable row level security;
alter table public.location_area_staffing_overrides enable row level security;
alter table public.location_area_service_hours enable row level security;
alter table public.area_shift_templates enable row level security;
alter table public.area_shift_template_breaks enable row level security;
alter table public.area_qualification_templates enable row level security;
alter table public.shifts enable row level security;
alter table public.absence_requests enable row level security;
alter table public.swap_requests enable row level security;
alter table public.shift_confirmation_events enable row level security;
alter table public.shift_requests enable row level security;
alter table public.shift_deletion_events enable row level security;
alter table public.confirmation_request_batches enable row level security;
alter table public.confirmation_request_items enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.manager_notifications enable row level security;

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

-- Profile shift preferences (Wunsch-Einsatzzeiten)
create policy "profile_shift_preferences_select_org"
  on public.profile_shift_preferences for select
  using (
    profile_id in (
      select id from public.profiles
      where organization_id in (select organization_id from private.current_profile())
    )
  );

create policy "profile_shift_preferences_write_manager"
  on public.profile_shift_preferences for all
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

create policy "profile_shift_preferences_write_own"
  on public.profile_shift_preferences for insert
  with check (profile_id = auth.uid());

create policy "profile_shift_preferences_update_own"
  on public.profile_shift_preferences for update
  using (profile_id = auth.uid());

create policy "profile_shift_preferences_delete_own"
  on public.profile_shift_preferences for delete
  using (profile_id = auth.uid());

-- Compensation surcharge types
create policy "compensation_surcharge_types_select_org"
  on public.compensation_surcharge_types for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

create policy "compensation_surcharge_types_write_manager"
  on public.compensation_surcharge_types for all
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

-- Profile compensation surcharges
create policy "profile_compensation_surcharges_select_org"
  on public.profile_compensation_surcharges for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

create policy "profile_compensation_surcharges_write_manager"
  on public.profile_compensation_surcharges for all
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

-- Location area staffing overrides (temporary per calendar date)
create policy "location_area_staffing_overrides_select_org"
  on public.location_area_staffing_overrides for select
  using (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (select organization_id from private.current_profile())
    )
  );

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

-- Area shift templates
create policy "area_shift_templates_select_org"
  on public.area_shift_templates for select
  using (
    location_area_id in (
      select la.id from public.location_areas la
      join public.locations l on l.id = la.location_id
      where l.organization_id in (select organization_id from private.current_profile())
    )
  );

create policy "area_shift_templates_write_manager"
  on public.area_shift_templates for all
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

create policy "area_shift_template_breaks_select_org"
  on public.area_shift_template_breaks for select
  using (
    area_shift_template_id in (
      select ast.id from public.area_shift_templates ast
      join public.location_areas la on la.id = ast.location_area_id
      join public.locations l on l.id = la.location_id
      where l.organization_id in (select organization_id from private.current_profile())
    )
  );

create policy "area_shift_template_breaks_write_manager"
  on public.area_shift_template_breaks for all
  using (
    area_shift_template_id in (
      select ast.id from public.area_shift_templates ast
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
      select ast.id from public.area_shift_templates ast
      join public.location_areas la on la.id = ast.location_area_id
      join public.locations l on l.id = la.location_id
      where l.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

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

create policy "absence_update_own"
  on public.absence_requests for update
  using (
    employee_id = auth.uid()
    and status in ('pending', 'approved')
  )
  with check (
    employee_id = auth.uid()
    and status in ('pending', 'approved', 'cancelled')
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

-- Shift confirmation events
create policy "shift_confirmation_events_select_manager"
  on public.shift_confirmation_events for select
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "shift_confirmation_events_select_own_shifts"
  on public.shift_confirmation_events for select
  using (
    exists (
      select 1
      from public.shifts s
      where s.id = shift_id
        and s.employee_id = auth.uid()
    )
  );

create policy "shift_requests_select_manager"
  on public.shift_requests for select
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "shift_requests_insert_manager"
  on public.shift_requests for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "shift_requests_update_manager"
  on public.shift_requests for update
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

create policy "shift_deletion_events_select_manager"
  on public.shift_deletion_events for select
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "shift_deletion_events_insert_manager"
  on public.shift_deletion_events for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
    and deleted_by = auth.uid()
  );

create policy "confirmation_request_batches_select_manager"
  on public.confirmation_request_batches for select
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "confirmation_request_items_select_manager"
  on public.confirmation_request_items for select
  using (
    batch_id in (
      select b.id from public.confirmation_request_batches b
      where b.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

create policy "notification_outbox_select_manager"
  on public.notification_outbox for select
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "manager_notifications_select_own"
  on public.manager_notifications for select
  using (recipient_profile_id = auth.uid());

create policy "manager_notifications_update_own"
  on public.manager_notifications for update
  using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());

create policy "shift_confirmation_events_insert_manager"
  on public.shift_confirmation_events for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "confirmation_request_batches_insert_manager"
  on public.confirmation_request_batches for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "confirmation_request_items_insert_manager"
  on public.confirmation_request_items for insert
  with check (
    batch_id in (
      select b.id from public.confirmation_request_batches b
      where b.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

create policy "notification_outbox_insert_manager"
  on public.notification_outbox for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "manager_notifications_insert_manager"
  on public.manager_notifications for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
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
