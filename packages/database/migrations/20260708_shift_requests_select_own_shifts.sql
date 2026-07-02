-- MA darf eigene shift_requests lesen (z. B. offene Absage → cancellationPending im Wochenplan).

drop policy if exists "shift_requests_select_own_shifts" on public.shift_requests;

create policy "shift_requests_select_own_shifts"
  on public.shift_requests for select
  using (
    exists (
      select 1
      from public.shifts s
      where s.id = shift_id
        and s.employee_id = auth.uid()
    )
  );
