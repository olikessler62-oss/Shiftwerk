-- Sprint 1: Schicht-Lifecycle und Anfragen (additiv, confirmation_status bleibt vorerst)
-- lifecycle_status + shift_requests parallel zum bestehenden Modell

do $$
begin
  create type public.shift_lifecycle_status as enum (
    'planned',
    'confirmed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.shift_request_type as enum (
    'confirmation',
    'cancellation'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.shift_request_status as enum (
    'pending',
    'approved',
    'rejected',
    'expired',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.shifts
  add column if not exists lifecycle_status public.shift_lifecycle_status;

comment on column public.shifts.lifecycle_status is
  'Planungs-Lifecycle (planned/confirmed/cancelled). Parallel zu confirmation_status bis Sprint 4.';

create index if not exists shifts_lifecycle_status_idx
  on public.shifts (organization_id, lifecycle_status, shift_date);

-- Backfill lifecycle aus confirmation_status
update public.shifts
set lifecycle_status = case confirmation_status
  when 'confirmed' then 'confirmed'::public.shift_lifecycle_status
  when 'canceled' then 'cancelled'::public.shift_lifecycle_status
  else 'planned'::public.shift_lifecycle_status
end
where lifecycle_status is null;

alter table public.shifts
  alter column lifecycle_status set default 'confirmed';

alter table public.shifts
  alter column lifecycle_status set not null;

create table if not exists public.shift_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  type public.shift_request_type not null,
  status public.shift_request_status not null default 'pending',
  actor_id uuid references public.profiles (id) on delete set null,
  sent_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz,
  reminder_sent_at timestamptz,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shift_requests_org_type_status_idx
  on public.shift_requests (organization_id, type, status);

create index if not exists shift_requests_shift_created_idx
  on public.shift_requests (shift_id, created_at desc);

create unique index if not exists shift_requests_open_confirmation_idx
  on public.shift_requests (shift_id)
  where type = 'confirmation' and status in ('pending', 'expired');

comment on table public.shift_requests is
  'Offene und abgeschlossene Anfragen zu Schichten (Bestätigung, Absage). Sprint 1: Backfill aus confirmation_status.';

-- Bestätigungsanfragen aus requested/pending/rejected
insert into public.shift_requests (
  organization_id,
  shift_id,
  type,
  status,
  sent_at,
  responded_at,
  reminder_sent_at,
  payload
)
select
  s.organization_id,
  s.id,
  'confirmation'::public.shift_request_type,
  case
    when s.confirmation_status = 'rejected' then 'rejected'::public.shift_request_status
    when s.confirmation_status = 'pending' then 'expired'::public.shift_request_status
    when s.confirmation_status = 'requested'
      and s.requested_at is not null
      and s.requested_at <= now() - interval '3 hours'
      then 'expired'::public.shift_request_status
    when s.confirmation_status = 'requested' then 'pending'::public.shift_request_status
    else 'cancelled'::public.shift_request_status
  end,
  s.requested_at,
  case
    when s.confirmation_status in ('rejected') then s.confirmation_status_updated_at
    else null
  end,
  s.pending_reminder_sent_at,
  '{}'::jsonb
from public.shifts s
where s.confirmation_status in ('requested', 'pending', 'rejected')
  and not exists (
    select 1
    from public.shift_requests sr
    where sr.shift_id = s.id
      and sr.type = 'confirmation'
  );

-- Absage-Anfragen aus canceled
insert into public.shift_requests (
  organization_id,
  shift_id,
  type,
  status,
  actor_id,
  sent_at,
  responded_at,
  payload
)
select
  s.organization_id,
  s.id,
  'cancellation'::public.shift_request_type,
  'approved'::public.shift_request_status,
  ev.actor_id,
  s.confirmation_status_updated_at,
  s.confirmation_status_updated_at,
  coalesce(ev.payload, '{}'::jsonb)
from public.shifts s
left join lateral (
  select e.actor_id, e.payload
  from public.shift_confirmation_events e
  where e.shift_id = s.id
    and e.to_status = 'canceled'
  order by e.created_at desc
  limit 1
) ev on true
where s.confirmation_status = 'canceled'
  and not exists (
    select 1
    from public.shift_requests sr
    where sr.shift_id = s.id
      and sr.type = 'cancellation'
  );

drop trigger if exists shift_requests_updated_at on public.shift_requests;

create trigger shift_requests_updated_at
  before update on public.shift_requests
  for each row execute function public.set_updated_at();

alter table public.shift_requests enable row level security;

drop policy if exists "shift_requests_select_manager" on public.shift_requests;

create policy "shift_requests_select_manager"
  on public.shift_requests for select
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

-- Übergangs-View: legacy confirmation_status aus lifecycle + Anfragen
create or replace view public.shifts_with_legacy_confirmation as
select
  s.*,
  case
    when s.lifecycle_status = 'cancelled'::public.shift_lifecycle_status then 'canceled'
    when s.lifecycle_status = 'confirmed'::public.shift_lifecycle_status then 'confirmed'
    when cr.status = 'pending'::public.shift_request_status then 'requested'
    when cr.status = 'expired'::public.shift_request_status then 'pending'
    when cr.status = 'rejected'::public.shift_request_status then 'rejected'
    else 'proposed'
  end as confirmation_status_legacy
from public.shifts s
left join lateral (
  select sr.status
  from public.shift_requests sr
  where sr.shift_id = s.id
    and sr.type = 'confirmation'
  order by sr.created_at desc
  limit 1
) cr on true;

comment on view public.shifts_with_legacy_confirmation is
  'Übergang: leitet confirmation_status aus lifecycle_status + shift_requests ab.';
