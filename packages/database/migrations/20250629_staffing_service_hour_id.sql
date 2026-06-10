-- Personalbedarf an Servicezeit-Fenster statt Schichtart
-- Idempotent: mehrfach ausführbar, erkennt ob alte Spalten noch existieren.

-- 1) Neue Spalte (IMMER zuerst — ohne diese schlagen alle folgenden Schritte fehl)
alter table public.location_area_staffing
  add column if not exists service_hour_id uuid
  references public.location_area_service_hours (id) on delete cascade;

-- 2) Bestehende Regeln migrieren (nur wenn shift_type_id noch vorhanden)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_area_staffing'
      and column_name = 'shift_type_id'
  ) then
    update public.location_area_staffing las
    set service_hour_id = (
      select lash.id
      from public.location_area_service_hours lash
      inner join public.shift_types st on st.id = las.shift_type_id
      where lash.location_area_id = las.location_area_id
        and lash.weekday = las.weekday
        and lash.start_time <= st.start_time
        and lash.end_time >= st.end_time
      order by lash.start_time
      limit 1
    )
    where las.service_hour_id is null
      and las.shift_type_id is not null;

    update public.location_area_staffing las
    set service_hour_id = (
      select lash.id
      from public.location_area_service_hours lash
      where lash.location_area_id = las.location_area_id
        and lash.weekday = las.weekday
      order by lash.start_time
      limit 1
    )
    where las.service_hour_id is null;

    delete from public.location_area_staffing where service_hour_id is null;
  end if;
end $$;

-- 3) Duplikate zusammenführen (mehrere Schichtarten → gleiches Servicefenster)
with ranked as (
  select
    id,
    sum(required_count) over (
      partition by service_hour_id, qualification_id
    ) as merged_count,
    row_number() over (
      partition by service_hour_id, qualification_id
      order by id
    ) as rn
  from public.location_area_staffing
  where service_hour_id is not null
)
update public.location_area_staffing las
set required_count = least(ranked.merged_count, 99)
from ranked
where las.id = ranked.id
  and ranked.rn = 1;

delete from public.location_area_staffing las
using (
  select id
  from (
    select
      id,
      row_number() over (
        partition by service_hour_id, qualification_id
        order by id
      ) as rn
    from public.location_area_staffing
    where service_hour_id is not null
  ) dup
  where dup.rn > 1
) to_remove
where las.id = to_remove.id;

-- 4) Alte Struktur entfernen
alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_area_shift_weekday_qual_unique;

alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_location_area_id_shift_type_id_weekday_key;

alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_location_area_id_shift_type_id_weekd_key;

alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_location_area_id_shift_type_id_weekday_k;

alter table public.location_area_staffing
  drop column if exists shift_type_id,
  drop column if exists weekday;

do $$
begin
  if not exists (
    select 1
    from public.location_area_staffing
    where service_hour_id is null
  ) then
    alter table public.location_area_staffing
      alter column service_hour_id set not null;
  end if;
end $$;

alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_service_hour_qual_unique;

alter table public.location_area_staffing
  add constraint location_area_staffing_service_hour_qual_unique
  unique (service_hour_id, qualification_id);

create index if not exists location_area_staffing_service_hour_id_idx
  on public.location_area_staffing (service_hour_id);

drop function if exists public.replace_location_area_staffing_for_shift_type(uuid, uuid, jsonb);

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
