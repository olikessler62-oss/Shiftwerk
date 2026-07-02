-- Schicht-Änderungen in der Vergangenheit in Planungs-UI erlauben (Default: aus)
alter table public.organizations
  add column if not exists allow_past_shift_changes boolean not null default false;

comment on column public.organizations.allow_past_shift_changes is
  'Erlaubt Zuweisungen und Änderungen vergangener Schichten in Planungs-UI; ohne Mitarbeiter-Benachrichtigung.';
