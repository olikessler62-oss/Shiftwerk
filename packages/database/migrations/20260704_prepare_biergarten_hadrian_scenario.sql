-- Superadmin-Testszenario „L'Orangerie & Biergarten“: vollständiger Standort-Reset.
-- Die App führt dieselbe Logik in TypeScript aus (prepareBiergartenHadrianScenario).

create or replace function public.prepare_biergarten_hadrian_scenario(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_ids uuid[];
  v_area_ids uuid[];
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
    industry = 'gastronomy'
  where id = p_organization_id;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_location_ids
  from public.locations
  where organization_id = p_organization_id;

  delete from public.shifts
  where organization_id = p_organization_id;

  delete from public.shifts_archive
  where organization_id = p_organization_id;

  select coalesce(array_agg(la.id), '{}'::uuid[])
  into v_area_ids
  from public.location_areas la
  where la.location_id = any (v_location_ids);

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

  delete from public.locations
  where id = any (v_location_ids);
end;
$$;

grant execute on function public.prepare_biergarten_hadrian_scenario(uuid) to service_role;
