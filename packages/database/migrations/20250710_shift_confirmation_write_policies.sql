-- Manager INSERT für Schichtbestätigung (Versand + Events)

create policy "shift_confirmation_events_insert_manager"
  on public.shift_confirmation_events for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "confirmation_request_batches_insert_manager"
  on public.confirmation_request_batches for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "confirmation_request_items_insert_manager"
  on public.confirmation_request_items for insert
  with check (
    batch_id in (
      select b.id from public.confirmation_request_batches b
      where b.organization_id in (
        select organization_id from private.current_profile()
        where permission_level in ('admin', 'manager')
      )
    )
  );

create policy "notification_outbox_insert_manager"
  on public.notification_outbox for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );

create policy "manager_notifications_insert_manager"
  on public.manager_notifications for insert
  with check (
    organization_id in (
      select organization_id from private.current_profile()
      where permission_level in ('admin', 'manager')
    )
  );
