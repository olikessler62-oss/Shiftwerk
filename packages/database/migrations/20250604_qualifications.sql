-- Qualifikationen (einmalig in Supabase ausführen)
-- Dashboard → SQL → New query → Run

create table if not exists public.qualifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create index if not exists qualifications_organization_id_idx
  on public.qualifications (organization_id);

alter table public.qualifications enable row level security;

drop policy if exists "qualifications_select_org" on public.qualifications;
create policy "qualifications_select_org"
  on public.qualifications for select
  using (
    organization_id in (select organization_id from public.current_profile())
  );

drop policy if exists "qualifications_write_manager" on public.qualifications;
create policy "qualifications_write_manager"
  on public.qualifications for all
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
