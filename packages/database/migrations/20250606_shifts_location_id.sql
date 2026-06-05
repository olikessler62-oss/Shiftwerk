-- Schichten → Standort (einmalig in Supabase ausführen)

alter table public.shifts
  add column if not exists location_id uuid references public.locations (id) on delete restrict;

create index if not exists shifts_location_id_idx on public.shifts (location_id);

-- Bestehende Schichten dem ersten Standort der Organisation zuordnen
update public.shifts s
set location_id = sub.location_id
from (
  select distinct on (organization_id)
    organization_id,
    id as location_id
  from public.locations
  order by organization_id, sort_order, id
) sub
where s.organization_id = sub.organization_id
  and s.location_id is null;
