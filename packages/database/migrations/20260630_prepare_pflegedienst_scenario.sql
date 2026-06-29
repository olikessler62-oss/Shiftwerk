-- Superadmin-Testszenario „Pflegedienst / Zentrale“: Baseline-Cleanup vor Neuaufbau.

create or replace function public.prepare_pflegedienst_scenario(p_organization_id uuid)
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

  update public.organizations
  set
    name = 'OKE Medicare',
    planning_mode = 'advanced',
    industry = 'care'
  where id = p_organization_id;

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

  delete from public.profile_shift_preferences
  where organization_id = p_organization_id;

  delete from public.profile_qualifications
  where profile_id in (
    select id from public.profiles where organization_id = p_organization_id
  );

  select coalesce(array_agg(la.id), '{}'::uuid[])
  into v_area_ids
  from public.location_areas la
  inner join public.locations l on l.id = la.location_id
  where l.organization_id = p_organization_id;

  if coalesce(array_length(v_area_ids, 1), 0) > 0 then
    delete from public.location_area_staffing_overrides
    where location_area_id = any (v_area_ids);

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

  update public.locations
  set archived_at = now()
  where organization_id = p_organization_id
    and lower(trim(name)) <> lower('Zentrale')
    and archived_at is null;

  update public.locations
  set archived_at = null
  where organization_id = p_organization_id
    and lower(trim(name)) = lower('Zentrale');

  delete from public.qualifications
  where organization_id = p_organization_id;
end;
$$;

grant execute on function public.prepare_pflegedienst_scenario(uuid) to service_role;
