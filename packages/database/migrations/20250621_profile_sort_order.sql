-- Eigene Reihenfolge für Profile und Verfügbarkeiten (sort_order)
-- Idempotent — sicher mehrfach ausführbar.

alter table public.profiles
  add column if not exists sort_order int not null default 0;

do $$
begin
  if not exists (select 1 from public.profiles where sort_order > 0 limit 1) then
    with ranked as (
      select
        id,
        row_number() over (
          partition by organization_id
          order by full_name, created_at
        ) - 1 as new_sort
      from public.profiles
    )
    update public.profiles p
    set sort_order = ranked.new_sort
    from ranked
    where p.id = ranked.id;
  end if;
end $$;

create index if not exists profiles_organization_sort_order_idx
  on public.profiles (organization_id, sort_order);

alter table public.profile_recurring_availability
  add column if not exists sort_order int not null default 0;

do $$
begin
  if not exists (
    select 1 from public.profile_recurring_availability where sort_order > 0 limit 1
  ) then
    with ranked as (
      select
        id,
        row_number() over (
          partition by profile_id
          order by weekday, start_time, created_at
        ) - 1 as new_sort
      from public.profile_recurring_availability
    )
    update public.profile_recurring_availability a
    set sort_order = ranked.new_sort
    from ranked
    where a.id = ranked.id;
  end if;
end $$;

create index if not exists profile_recurring_availability_profile_sort_idx
  on public.profile_recurring_availability (profile_id, sort_order);
