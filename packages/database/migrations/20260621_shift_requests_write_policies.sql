-- Manager dürfen shift_requests schreiben (Server-Actions / Service-Role-kompatibel)

drop policy if exists "shift_requests_insert_manager" on public.shift_requests;
drop policy if exists "shift_requests_update_manager" on public.shift_requests;

create policy "shift_requests_insert_manager"
  on public.shift_requests for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "shift_requests_update_manager"
  on public.shift_requests for update
  using (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );
