-- Manueller Purge-Lauf (Spec 006 Phase 2)
-- Cutoff: heute minus 25 Monate — archivierte Schichten davor endgültig löschen

select public.purge_shifts_archive_batch((current_date - interval '25 months')::date, 5000);
