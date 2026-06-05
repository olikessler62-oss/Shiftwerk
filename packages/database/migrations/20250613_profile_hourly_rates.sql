-- Stundensätze pro Profil mit Gültigkeitszeitraum (Historie)
-- Idempotent — sicher mehrfach ausführbar.

create table if not exists public.profile_hourly_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'EUR',
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint profile_hourly_rates_valid_range_check
    check (valid_to is null or valid_to >= valid_from)
);

create index if not exists profile_hourly_rates_profile_id_idx
  on public.profile_hourly_rates (profile_id);

create index if not exists profile_hourly_rates_profile_valid_from_idx
  on public.profile_hourly_rates (profile_id, valid_from desc);

create unique index if not exists profile_hourly_rates_one_open_per_profile
  on public.profile_hourly_rates (profile_id)
  where valid_to is null;

alter table public.profile_hourly_rates enable row level security;

drop policy if exists "profile_hourly_rates_select_org" on public.profile_hourly_rates;
create policy "profile_hourly_rates_select_org"
  on public.profile_hourly_rates for select
  using (
    organization_id in (select organization_id from public.current_profile())
  );

drop policy if exists "profile_hourly_rates_write_manager" on public.profile_hourly_rates;
create policy "profile_hourly_rates_write_manager"
  on public.profile_hourly_rates for all
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from public.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );
