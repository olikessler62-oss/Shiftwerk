-- Mehrfach-Schichtzuweisung: Schichttyp optional (Uhrzeiten maßgeblich)

alter table public.shifts
  alter column shift_type_id drop not null;
