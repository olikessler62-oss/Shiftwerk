-- Remove unused per-day availability table (replaced by profile_recurring_availability + absence_requests).

drop policy if exists "availability_select" on public.availability;
drop policy if exists "availability_insert_own" on public.availability;
drop policy if exists "availability_update_own" on public.availability;
drop policy if exists "availability_delete_own" on public.availability;

drop table if exists public.availability;

drop type if exists public.availability_status;
