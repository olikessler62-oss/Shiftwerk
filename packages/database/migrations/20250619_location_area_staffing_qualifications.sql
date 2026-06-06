-- Personalbedarf pro Qualifikation (Bereich × Schichtart × Wochentag × Qualifikation)

alter table public.location_area_staffing
  add column if not exists qualification_id uuid references public.qualifications (id) on delete restrict;

update public.location_area_staffing las
set qualification_id = sub.qid
from (
  select
    las2.id as staffing_id,
    (
      select q.id
      from public.qualifications q
      inner join public.location_areas la on la.id = las2.location_area_id
      inner join public.locations l on l.id = la.location_id
      where q.organization_id = l.organization_id
        and q.archived_at is null
      order by q.sort_order, q.name
      limit 1
    ) as qid
  from public.location_area_staffing las2
) sub
where las.id = sub.staffing_id
  and las.qualification_id is null;

delete from public.location_area_staffing where qualification_id is null;

alter table public.location_area_staffing
  alter column qualification_id set not null;

alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_location_area_id_shift_type_id_weekday_key;

alter table public.location_area_staffing
  drop constraint if exists location_area_staffing_area_shift_weekday_qual_unique;

alter table public.location_area_staffing
  add constraint location_area_staffing_area_shift_weekday_qual_unique
  unique (location_area_id, shift_type_id, weekday, qualification_id);

create index if not exists location_area_staffing_qualification_id_idx
  on public.location_area_staffing (qualification_id);
