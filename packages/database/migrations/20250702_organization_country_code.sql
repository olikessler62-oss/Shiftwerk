-- Land / Compliance-Profil pro Organisation (einmalig in Supabase ausführen)

alter table public.organizations
  add column if not exists country_code char(2) not null default 'DE';

comment on column public.organizations.country_code is
  'ISO 3166-1 alpha-2 — verweist auf compliances/{land}.md';
