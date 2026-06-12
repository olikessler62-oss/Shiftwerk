-- Planungsmodus & Branche auf Organisationsebene (Spec 004, Schritt 1)

alter table public.organizations
  add column if not exists planning_mode text not null default 'simple'
    check (planning_mode in ('simple', 'advanced')),
  add column if not exists industry text
    check (industry is null or industry in ('gastronomy', 'care', 'retail', 'other'));

comment on column public.organizations.planning_mode is
  'Führender Planungsmodus: simple = reduzierte UI, advanced = voller Funktionsumfang.';

comment on column public.organizations.industry is
  'Branche (Onboarding/Seeding); steuert keine UI-Logik direkt.';

-- Bestandsorganisationen behalten bisheriges Verhalten (Bereiche, Bedarf, …)
update public.organizations
set planning_mode = 'advanced'
where planning_mode = 'simple';
