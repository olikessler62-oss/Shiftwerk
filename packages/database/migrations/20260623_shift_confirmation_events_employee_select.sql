-- Mitarbeiter dürfen Storno-Ereignisse ihrer eigenen Schichten lesen (Mobile-Wochenplan).
create policy "shift_confirmation_events_select_own_shifts"
  on public.shift_confirmation_events for select
  using (
    exists (
      select 1
      from public.shifts s
      where s.id = shift_id
        and s.employee_id = auth.uid()
    )
  );
