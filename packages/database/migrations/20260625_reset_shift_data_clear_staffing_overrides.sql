-- Data reset: also clear temporary staffing overrides for the organization.

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
