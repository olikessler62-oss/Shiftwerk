-- Standorte (einmalig in Supabase ausführen)
-- Dashboard → SQL → New query → Run

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  active_weekdays char(7) not null default '1111100',
  on_holiday_open boolean not null default false,
  sort_order int not null default 0,
  constraint locations_active_weekdays_check check (active_weekdays ~ '^[01]{7}$')
);

create index if not exists locations_organization_id_idx
  on public.locations (organization_id);

alter table public.locations enable row level security;

drop policy if exists "locations_select_org" on public.locations;
create policy "locations_select_org"
  on public.locations for select
  using (
    organization_id in (select organization_id from public.current_profile())
  );

drop policy if exists "locations_write_manager" on public.locations;
create policy "locations_write_manager"
  on public.locations for all
  using (
    organization_id in (
      select organization_id from public.current_profile()
      where role in ('owner', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from public.current_profile()
      where role in ('owner', 'manager')
    )
  );
