-- Manager CRUD for absence_requests + date range check

alter table public.absence_requests
  drop constraint if exists absence_requests_date_range_check;

alter table public.absence_requests
  add constraint absence_requests_date_range_check
  check (start_date <= end_date);

drop policy if exists "absence_insert_manager" on public.absence_requests;
create policy "absence_insert_manager"
  on public.absence_requests for insert
  with check (
    private.is_manager_or_owner()
    and organization_id in (select organization_id from private.current_profile())
    and exists (
      select 1
      from public.profiles p
      where p.id = employee_id
        and p.organization_id = absence_requests.organization_id
    )
  );

drop policy if exists "absence_delete_manager" on public.absence_requests;
create policy "absence_delete_manager"
  on public.absence_requests for delete
  using (
    organization_id in (select organization_id from private.current_profile())
    and private.is_manager_or_owner()
  );
