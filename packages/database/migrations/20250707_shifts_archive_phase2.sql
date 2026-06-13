-- Phase 2: Archiv-Tabelle, Retention-Jobs (Spec 006)
-- Hot → shifts_archive (Monat 14–25), danach Purge

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
revoke all on function public.log_shift_retention_run(text, date, bigint, bigint, int) from public;

grant execute on function public.cancel_pending_swaps_before_shift_archive(date) to service_role;
grant execute on function public.archive_shifts_batch(date, int) to service_role;
grant execute on function public.purge_shifts_archive_batch(date, int) to service_role;
grant execute on function public.log_shift_retention_run(text, date, bigint, bigint, int) to service_role;

grant all on table private.shift_retention_runs to service_role;
