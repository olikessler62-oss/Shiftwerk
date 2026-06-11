-- Mitarbeiter-Verfügbarkeiten: nur Uhrzeiten, keine Schichtart-Verknüpfung mehr.
update public.profile_recurring_availability
set shift_type_id = null
where shift_type_id is not null;
