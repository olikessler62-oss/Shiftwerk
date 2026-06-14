-- Shift confirmation Phase 1 (Spec 008)
-- Status auf shifts, Versand-Batches, Events, simulierte Benachrichtigungen

do $$
begin
  create type public.shift_confirmation_status as enum (
    'proposed',
    'requested',
    'confirmed',
    'rejected',
    'pending'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.organizations
  add column if not exists shift_confirmation_enabled boolean not null default false,
  add column if not exists shift_confirmation_disclaimer text;

comment on column public.organizations.shift_confirmation_enabled is
  'Schichtbestätigung durch Mitarbeiter aktiv. Aus = neue Zuweisungen direkt confirmed.';

alter table public.profiles
  add column if not exists app_registered_at timestamptz,
  add column if not exists email_fallback_mode boolean not null default false;

comment on column public.profiles.app_registered_at is
  'Erste Mobile-App-Registrierung; Pflicht für Zuweisbarkeit wenn Schichtbestätigung aktiv.';

comment on column public.profiles.email_fallback_mode is
  'Manager aktiviert E-Mail-Fallback (Phase 1 simuliert) bei verlorenem Gerät.';

alter table public.shifts
  add column if not exists confirmation_status public.shift_confirmation_status not null default 'confirmed',
  add column if not exists confirmation_status_updated_at timestamptz not null default now(),
  add column if not exists requested_at timestamptz,
  add column if not exists pending_since timestamptz,
  add column if not exists pending_reminder_sent_at timestamptz;

create index if not exists shifts_confirmation_status_idx
  on public.shifts (organization_id, confirmation_status, shift_date);

update public.shifts
set
  confirmation_status = 'confirmed',
  confirmation_status_updated_at = now()
where employee_id is not null;

create table if not exists public.shift_confirmation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  from_status public.shift_confirmation_status,
  to_status public.shift_confirmation_status not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists shift_confirmation_events_shift_idx
  on public.shift_confirmation_events (shift_id, created_at desc);

create table if not exists public.confirmation_request_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  sent_by uuid not null references public.profiles (id) on delete restrict,
  scope text not null check (scope in (
    'single_shift', 'employee_day', 'employee_week', 'bulk_week'
  )),
  week_start date not null,
  week_end date not null,
  is_delta boolean not null default false,
  sent_at timestamptz not null default now()
);

create index if not exists confirmation_request_batches_employee_week_idx
  on public.confirmation_request_batches (employee_id, week_start, week_end);

create table if not exists public.confirmation_request_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.confirmation_request_batches (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (batch_id, shift_id)
);

create index if not exists confirmation_request_items_shift_idx
  on public.confirmation_request_items (shift_id, created_at desc);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('push', 'email')),
  template_key text not null,
  payload jsonb not null default '{}',
  simulated boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists notification_outbox_org_created_idx
  on public.notification_outbox (organization_id, created_at desc);

create table if not exists public.manager_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists manager_notifications_recipient_idx
  on public.manager_notifications (recipient_profile_id, created_at desc)
  where dismissed_at is null;

alter table public.shift_confirmation_events enable row level security;
alter table public.confirmation_request_batches enable row level security;
alter table public.confirmation_request_items enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.manager_notifications enable row level security;

create policy "shift_confirmation_events_select_manager"
  on public.shift_confirmation_events for select
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "confirmation_request_batches_select_manager"
  on public.confirmation_request_batches for select
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "confirmation_request_items_select_manager"
  on public.confirmation_request_items for select
  using (
    batch_id in (
      select b.id from public.confirmation_request_batches b
      where b.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

create policy "notification_outbox_select_manager"
  on public.notification_outbox for select
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "manager_notifications_select_own"
  on public.manager_notifications for select
  using (recipient_profile_id = auth.uid());

create policy "manager_notifications_update_own"
  on public.manager_notifications for update
  using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());
