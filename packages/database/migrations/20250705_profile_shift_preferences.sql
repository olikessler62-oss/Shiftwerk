-- Wunsch-Einsatzzeiten pro Profil (Mobile CRUD, Web Bulk liest)

create table if not exists public.profile_shift_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null,
  start_time time not null,
  end_time time not null,
  location_area_id uuid references public.location_areas (id) on delete set null,
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_shift_preferences_weekday_check check (weekday >= 0 and weekday <= 7),
  constraint profile_shift_preferences_time_check check (start_time <> end_time)
);

create index if not exists profile_shift_preferences_org_profile_weekday_idx
  on public.profile_shift_preferences (organization_id, profile_id, weekday);

create index if not exists profile_shift_preferences_area_idx
  on public.profile_shift_preferences (location_area_id)
  where location_area_id is not null;

alter table public.profile_shift_preferences enable row level security;

drop policy if exists "profile_shift_preferences_select_org"
  on public.profile_shift_preferences;
create policy "profile_shift_preferences_select_org"
  on public.profile_shift_preferences for select
  using (
    profile_id in (
      select id from public.profiles
      where organization_id in (select organization_id from private.current_profile())
    )
  );

drop policy if exists "profile_shift_preferences_write_manager"
  on public.profile_shift_preferences;
create policy "profile_shift_preferences_write_manager"
  on public.profile_shift_preferences for all
  using (
    profile_id in (
      select p.id from public.profiles p
      where p.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  )
  with check (
    profile_id in (
      select p.id from public.profiles p
      where p.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

drop policy if exists "profile_shift_preferences_write_own"
  on public.profile_shift_preferences;
create policy "profile_shift_preferences_write_own"
  on public.profile_shift_preferences for insert
  with check (profile_id = auth.uid());

drop policy if exists "profile_shift_preferences_update_own"
  on public.profile_shift_preferences;
create policy "profile_shift_preferences_update_own"
  on public.profile_shift_preferences for update
  using (profile_id = auth.uid());

drop policy if exists "profile_shift_preferences_delete_own"
  on public.profile_shift_preferences;
create policy "profile_shift_preferences_delete_own"
  on public.profile_shift_preferences for delete
  using (profile_id = auth.uid());
