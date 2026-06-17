-- Open-ended sick leave, expected end, reported_by, org auto-approve flag

alter table public.organizations
  add column if not exists auto_approve_sick_absence boolean not null default true;

alter table public.absence_requests
  add column if not exists is_open_ended boolean not null default false,
  add column if not exists expected_end_date date,
  add column if not exists reported_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.absence_requests
  alter column end_date drop not null;

alter table public.absence_requests
  drop constraint if exists absence_requests_date_range_check;

alter table public.absence_requests
  add constraint absence_requests_date_range_check check (
    (is_open_ended = true and end_date is null)
    or (is_open_ended = false and end_date is not null and start_date <= end_date)
  );

alter table public.absence_requests
  add constraint absence_requests_open_ended_sick_only check (
    is_open_ended = false or type = 'sick'
  );

drop trigger if exists absence_requests_updated_at on public.absence_requests;
create trigger absence_requests_updated_at
  before update on public.absence_requests
  for each row execute function public.set_updated_at();

drop policy if exists "absence_update_own" on public.absence_requests;
create policy "absence_update_own"
  on public.absence_requests for update
  using (
    employee_id = auth.uid()
    and status in ('pending', 'approved')
  )
  with check (
    employee_id = auth.uid()
    and status in ('pending', 'approved', 'cancelled')
  );
