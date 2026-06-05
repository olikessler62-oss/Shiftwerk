-- Optional: Doppelte Schichtarten archivieren (behält je Name die erste nach sort_order).
-- Im Supabase SQL Editor ausführen, danach App neu laden.

with ranked as (
  select
    id,
    row_number() over (
      partition by organization_id, lower(trim(name))
      order by sort_order, id
    ) as rn
  from public.shift_types
  where archived_at is null
)
update public.shift_types st
set archived_at = now()
from ranked r
where st.id = r.id
  and r.rn > 1;
