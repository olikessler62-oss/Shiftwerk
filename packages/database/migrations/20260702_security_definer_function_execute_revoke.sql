-- Supabase linter 0028/0029: SECURITY DEFINER functions in public must not be
-- EXECUTE-able by anon or authenticated (RLS bypass via /rest/v1/rpc).
-- REVOKE FROM public alone is insufficient when roles have direct EXECUTE grants.
-- Uses pg_proc so missing or differently-typed functions do not fail the migration.

do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prokind = 'f'
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from anon, authenticated, public',
      r.schema_name, r.function_name, r.args
    );
    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      r.schema_name, r.function_name, r.args
    );
  end loop;
end $$;

-- Authenticated-only RPC helpers (SECURITY INVOKER): keep anon out.
do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not p.prosecdef
      and p.prokind = 'f'
      and p.proname in (
        'count_shifts_conflicting_with_absence_ranges',
        'current_date_iso',
        'replace_location_area_staffing_for_service_hour'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from anon, public',
      r.schema_name, r.function_name, r.args
    );
    execute format(
      'grant execute on function %I.%I(%s) to authenticated, service_role',
      r.schema_name, r.function_name, r.args
    );
  end loop;
end $$;
