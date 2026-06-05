-- Profil: einsetzbar in der Planung (schedulable)
-- Idempotent — sicher mehrfach ausführbar.

alter table public.profiles add column if not exists schedulable boolean not null default true;
