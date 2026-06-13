-- Manueller Archiv-Lauf (Spec 006 Phase 2)
-- Cutoff: heute minus 13 Monate — Schichten mit shift_date davor → shifts_archive
-- Pending swap_requests werden vorher auf cancelled gesetzt.

-- Hot-Cutoff anpassen oder current_date nutzen:
-- select public.cancel_pending_swaps_before_shift_archive((current_date - interval '13 months')::date);
-- select public.archive_shifts_batch((current_date - interval '13 months')::date, 5000);

-- Batch-Schleife (SQL Editor mehrfach ausführen bis 0):
select public.archive_shifts_batch((current_date - interval '13 months')::date, 5000);
