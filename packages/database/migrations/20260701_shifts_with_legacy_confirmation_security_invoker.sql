-- Supabase linter: views default to SECURITY DEFINER; use invoker RLS like public.coworkers.

alter view public.shifts_with_legacy_confirmation set (security_invoker = true);
