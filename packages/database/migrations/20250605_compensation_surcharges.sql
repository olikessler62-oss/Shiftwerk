-- Sonderzuschläge: Organisations-Katalog + Profil-Zuordnung mit Historie
-- Idempotent — sicher mehrfach ausführbar.

create table if not exists public.compensation_surcharge_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  trigger text not null check (trigger in ('public_holiday')),
  amount numeric(10, 2) not null check (amount >= 0),
  unit text not null check (unit in ('eur_per_hour', 'percent_of_base')),
  sort_order int not null default 0,
  archived_at timestamptz
);

create index if not exists compensation_surcharge_types_organization_id_idx
  on public.compensation_surcharge_types (organization_id);

create table if not exists public.profile_compensation_surcharges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  surcharge_type_id uuid not null references public.compensation_surcharge_types (id) on delete restrict,
  amount numeric(10, 2) check (amount is null or amount >= 0),
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint profile_compensation_surcharges_valid_range_check
    check (valid_to is null or valid_to >= valid_from)
);

create index if not exists profile_compensation_surcharges_profile_id_idx
  on public.profile_compensation_surcharges (profile_id);

create index if not exists profile_compensation_surcharges_profile_type_valid_from_idx
  on public.profile_compensation_surcharges (profile_id, surcharge_type_id, valid_from desc);

create unique index if not exists profile_compensation_surcharges_one_open_per_type
  on public.profile_compensation_surcharges (profile_id, surcharge_type_id)
  where valid_to is null;

alter table public.compensation_surcharge_types enable row level security;
alter table public.profile_compensation_surcharges enable row level security;

drop policy if exists "compensation_surcharge_types_select_org" on public.compensation_surcharge_types;
create policy "compensation_surcharge_types_select_org"
  on public.compensation_surcharge_types for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

drop policy if exists "compensation_surcharge_types_write_manager" on public.compensation_surcharge_types;
create policy "compensation_surcharge_types_write_manager"
  on public.compensation_surcharge_types for all
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

drop policy if exists "profile_compensation_surcharges_select_org" on public.profile_compensation_surcharges;
create policy "profile_compensation_surcharges_select_org"
  on public.profile_compensation_surcharges for select
  using (
    organization_id in (select organization_id from private.current_profile())
  );

drop policy if exists "profile_compensation_surcharges_write_manager" on public.profile_compensation_surcharges;
create policy "profile_compensation_surcharges_write_manager"
  on public.profile_compensation_surcharges for all
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );
