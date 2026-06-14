-- Audit-Trail für gelöschte Schichten (wer / wann + Snapshot)
-- Idempotent — sicher mehrfach ausführbar.

create table if not exists public.shift_deletion_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shift_id uuid not null,
  deleted_by uuid not null references public.profiles (id) on delete restrict,
  deleted_at timestamptz not null default now(),
  snapshot jsonb not null
);

create index if not exists shift_deletion_events_org_deleted_at_idx
  on public.shift_deletion_events (organization_id, deleted_at desc);

create index if not exists shift_deletion_events_shift_id_idx
  on public.shift_deletion_events (shift_id);

comment on table public.shift_deletion_events is
  'Unveränderlicher Audit-Eintrag pro gelöschter Schicht (Snapshot vor DELETE).';

alter table public.shift_deletion_events enable row level security;

create policy "shift_deletion_events_select_manager"
  on public.shift_deletion_events for select
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "shift_deletion_events_insert_manager"
  on public.shift_deletion_events for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
    and deleted_by = auth.uid()
  );
