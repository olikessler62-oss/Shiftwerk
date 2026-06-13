-- Phase 1: Dashboard-Index + Konflikt-Count per SQL (Spec 006)

create index if not exists shifts_org_location_date_idx
  on public.shifts (organization_id, location_id, shift_date);

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
