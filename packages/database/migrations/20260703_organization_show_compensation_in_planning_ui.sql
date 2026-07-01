-- Entgelt/Zuschläge in Planungs-UI (Kalender, Dashboard) ein-/ausblendbar
alter table public.organizations
  add column if not exists show_compensation_in_planning_ui boolean not null default true;

comment on column public.organizations.show_compensation_in_planning_ui is
  'Zeigt Entgelt und Zuschläge in Mitarbeiter-/Einsatzbereich-Kalender und Dashboard.';
