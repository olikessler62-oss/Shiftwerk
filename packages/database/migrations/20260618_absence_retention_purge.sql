-- Abwesenheiten mit Enddatum älter als 12 Monate batchweise löschen (Service-Role-Cron).

create or replace function public.purge_expired_absence_requests_batch(
  p_purge_cutoff date,
  p_batch_size int default 1000
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purged bigint;
begin
  with batch as (
    select id
    from public.absence_requests
    where end_date is not null
      and end_date < p_purge_cutoff
    order by end_date
    limit p_batch_size
    for update skip locked
  )
  delete from public.absence_requests a
  using batch b
  where a.id = b.id;

  get diagnostics v_purged = row_count;
  return v_purged;
end;
$$;

revoke all on function public.purge_expired_absence_requests_batch(date, int) from public;
grant execute on function public.purge_expired_absence_requests_batch(date, int) to service_role;
