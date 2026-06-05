-- Einmal im Supabase SQL Editor ausführen (idempotent).
-- Behebt: "column profiles.color does not exist"
--         "column profiles.mobile_phone does not exist"
--         "column profiles.schedulable does not exist"
-- Entspricht migrations/20250614 + 20250615

alter table public.profiles add column if not exists mobile_phone text;
alter table public.profiles add column if not exists color text;
alter table public.profiles add column if not exists schedulable boolean not null default true;

alter table public.profiles drop constraint if exists profiles_mobile_phone_check;
alter table public.profiles add constraint profiles_mobile_phone_check
  check (mobile_phone is null or (char_length(mobile_phone) <= 20 and mobile_phone ~ '^[0-9]+$'));

alter table public.profiles drop constraint if exists profiles_email_length_check;
alter table public.profiles add constraint profiles_email_length_check
  check (char_length(email) <= 60);

create unique index if not exists profiles_organization_color_unique
  on public.profiles (organization_id, color)
  where color is not null;
