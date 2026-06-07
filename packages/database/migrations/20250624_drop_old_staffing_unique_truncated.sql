-- Fix: alter Unique-Constraint-Name ist in PostgreSQL auf 63 Zeichen gekürzt
-- (location_area_staffing_location_area_id_shift_type_id_weekd_key).
-- DROP mit dem vollen Namen ...weekday_key trifft ihn nicht — Migration 20250623 wirkte leer.
-- Idempotent.

do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'location_area_staffing'
      and c.contype = 'u'
      and not exists (
        select 1
        from pg_attribute a
        where a.attrelid = c.conrelid
          and a.attname = 'qualification_id'
          and a.attnum = any (c.conkey)
      )
      and exists (
        select 1
        from pg_attribute a
        where a.attrelid = c.conrelid
          and a.attname = 'weekday'
          and a.attnum = any (c.conkey)
      )
  loop
    execute format(
      'alter table public.location_area_staffing drop constraint %I',
      con.conname
    );
  end loop;
end $$;

-- Explizit (falls der Name exakt so gespeichert ist)
alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_location_area_id_shift_type_id_weekd_key;

alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_location_area_id_shift_type_id_weekday_k;

alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_location_area_id_shift_type_id_weekday_key;

alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_area_shift_weekday_qual_unique;

alter table public.location_area_staffing
  add constraint location_area_staffing_area_shift_weekday_qual_unique
  unique (location_area_id, shift_type_id, weekday, qualification_id);

create or replace function public.replace_location_area_staffing_for_shift_type(
  p_location_area_id uuid,
  p_shift_type_id uuid,
  p_rules jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.location_area_staffing
  where location_area_id = p_location_area_id
    and shift_type_id = p_shift_type_id;

  if p_rules is null or jsonb_array_length(p_rules) = 0 then
    return;
  end if;

  insert into public.location_area_staffing (
    location_area_id,
    shift_type_id,
    qualification_id,
    weekday,
    required_count
  )
  select
    p_location_area_id,
    p_shift_type_id,
    (r->>'qualification_id')::uuid,
    (r->>'weekday')::smallint,
    (r->>'required_count')::int
  from jsonb_array_elements(p_rules) as r
  where coalesce((r->>'required_count')::int, 0) > 0;
end;
$$;

grant execute on function public.replace_location_area_staffing_for_shift_type(uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.replace_location_area_staffing_for_shift_type(uuid, uuid, jsonb)
  to service_role;
