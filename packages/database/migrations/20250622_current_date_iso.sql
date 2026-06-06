-- Referenzdatum der Datenbank (nicht Client-Systemzeit)
-- Idempotent — sicher mehrfach ausführbar.

create or replace function public.current_date_iso()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select to_char(current_date, 'YYYY-MM-DD');
$$;

grant execute on function public.current_date_iso() to authenticated;
grant execute on function public.current_date_iso() to service_role;
