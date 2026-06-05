-- Profil ↔ Qualifikation (n:m)
-- Idempotent — sicher mehrfach ausführbar.

create table if not exists public.profile_qualifications (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, qualification_id)
);

create index if not exists profile_qualifications_profile_id_idx
  on public.profile_qualifications (profile_id);

create index if not exists profile_qualifications_qualification_id_idx
  on public.profile_qualifications (qualification_id);

alter table public.profile_qualifications enable row level security;

drop policy if exists "profile_qualifications_select_org" on public.profile_qualifications;
create policy "profile_qualifications_select_org"
  on public.profile_qualifications for select
  using (
    profile_id in (
      select id from public.profiles
      where organization_id in (select organization_id from public.current_profile())
    )
  );

drop policy if exists "profile_qualifications_write_manager" on public.profile_qualifications;
create policy "profile_qualifications_write_manager"
  on public.profile_qualifications for all
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
