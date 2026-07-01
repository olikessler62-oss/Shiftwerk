-- Ab wann requested → pending (Minuten nach requested_at); Standard 3 Stunden
alter table public.organizations
  add column if not exists shift_confirmation_pending_after_minutes integer not null default 180
    check (
      shift_confirmation_pending_after_minutes > 0
      and shift_confirmation_pending_after_minutes <= 1440
    );
