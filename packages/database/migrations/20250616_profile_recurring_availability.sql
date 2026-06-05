-- Wiederkehrende Verfügbarkeiten pro Profil und Wochentag (mehrere Slots möglich)
-- Idempotent — sicher mehrfach ausführbar.

create table if not exists public.profile_recurring_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 6),
  start_time time not null,
  end_time time not null,
  shift_type_id uuid references public.shift_types (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint profile_recurring_availability_time_check check (end_time > start_time)
);

create index if not exists profile_recurring_availability_profile_id_idx
  on public.profile_recurring_availability (profile_id);

create index if not exists profile_recurring_availability_profile_weekday_idx
  on public.profile_recurring_availability (profile_id, weekday, start_time);

alter table public.profile_recurring_availability enable row level security;

drop policy if exists "profile_recurring_availability_select_org"
  on public.profile_recurring_availability;
create policy "profile_recurring_availability_select_org"
  on public.profile_recurring_availability for select
  using (
    profile_id in (
      select id from public.profiles
      where organization_id in (select organization_id from public.current_profile())
    )
  );

drop policy if exists "profile_recurring_availability_write_manager"
  on public.profile_recurring_availability;
create policy "profile_recurring_availability_write_manager"
  on public.profile_recurring_availability for all
  using (
    profile_id in (
      select p.id from public.profiles p
      where p.organization_id in (
        select organization_id from public.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    profile_id in (
      select p.id from public.profiles p
      where p.organization_id in (
        select organization_id from public.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

drop policy if exists "profile_recurring_availability_write_own"
  on public.profile_recurring_availability;
create policy "profile_recurring_availability_write_own"
  on public.profile_recurring_availability for insert
  with check (profile_id = auth.uid());

drop policy if exists "profile_recurring_availability_update_own"
  on public.profile_recurring_availability;
create policy "profile_recurring_availability_update_own"
  on public.profile_recurring_availability for update
  using (profile_id = auth.uid());

drop policy if exists "profile_recurring_availability_delete_own"
  on public.profile_recurring_availability;
create policy "profile_recurring_availability_delete_own"
  on public.profile_recurring_availability for delete
  using (profile_id = auth.uid());
