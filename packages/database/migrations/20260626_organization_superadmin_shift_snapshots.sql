-- Superadmin: Schicht-Snapshot für Daten-Reset (speichern + nach Reset wiederherstellen).

create table if not exists public.organization_superadmin_shift_snapshots (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  shifts jsonb not null default '[]'::jsonb,
  saved_at timestamptz not null default now()
);

alter table public.organization_superadmin_shift_snapshots enable row level security;

drop policy if exists "organization_superadmin_shift_snapshots_deny_clients"
  on public.organization_superadmin_shift_snapshots;
create policy "organization_superadmin_shift_snapshots_deny_clients"
  on public.organization_superadmin_shift_snapshots for all
  to authenticated
  using (false)
  with check (false);

grant all on table public.organization_superadmin_shift_snapshots to service_role;

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
