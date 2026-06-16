-- Dev/demo reset: clears operational data for one organization.
-- Preserves: organizations, locations, roles, qualifications.

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
