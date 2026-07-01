-- Superadmin-Testszenario „Pflegedienst / Medicare Pflegedienst“: Baseline-Cleanup vor Neuaufbau.
-- Hinweis: Die App führt preparePflegedienstScenario() in TypeScript aus (Admin-Client).
-- Diese Funktion dokumentiert dieselbe Logik für manuelle Ausführung im SQL Editor.

create or replace function public.prepare_pflegedienst_scenario(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_ids uuid[];
begin
  if not exists (
    select 1 from public.organizations where id = p_organization_id
  ) then
    raise exception 'organization not found';
  end if;

  update public.organizations
  set
    name = 'Giovanni''s Gastro',
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

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_location_ids
  from public.locations
  where organization_id = p_organization_id;

  if coalesce(array_length(v_location_ids, 1), 0) > 0 then
    delete from public.location_area_staffing_overrides
    where location_area_id in (
      select la.id
      from public.location_areas la
      where la.location_id = any (v_location_ids)
    );

    delete from public.location_area_staffing
    where location_area_id in (
      select la.id
      from public.location_areas la
      where la.location_id = any (v_location_ids)
    );

    delete from public.location_area_service_hours
    where location_area_id in (
      select la.id
      from public.location_areas la
      where la.location_id = any (v_location_ids)
    );

    delete from public.area_shift_template_breaks
    where area_shift_template_id in (
      select ast.id
      from public.area_shift_templates ast
      inner join public.location_areas la on la.id = ast.location_area_id
      where la.location_id = any (v_location_ids)
    );

    delete from public.area_shift_templates
    where location_area_id in (
      select la.id
      from public.location_areas la
      where la.location_id = any (v_location_ids)
    );

    delete from public.area_qualification_templates
    where location_area_id in (
      select la.id
      from public.location_areas la
      where la.location_id = any (v_location_ids)
    );

    delete from public.location_areas
    where location_id = any (v_location_ids);

    delete from public.locations
    where id = any (v_location_ids)
      and organization_id = p_organization_id;
  end if;

  delete from public.qualifications
  where organization_id = p_organization_id;
end;
$$;

grant execute on function public.prepare_pflegedienst_scenario(uuid) to service_role;
