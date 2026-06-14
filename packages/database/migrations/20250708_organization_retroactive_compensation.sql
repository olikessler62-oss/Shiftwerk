-- Nachträgliche Entgelteinträge pro Organisation (Standard: erlaubt)

alter table public.organizations
  add column if not exists allow_retroactive_compensation_entries boolean not null default true;

comment on column public.organizations.allow_retroactive_compensation_entries is
  'Erlaubt Stundensätze mit Gültig-ab in der Vergangenheit. Zukünftige Einträge sind immer möglich.';
