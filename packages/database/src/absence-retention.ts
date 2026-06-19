import { subtractCalendarMonths, toISODateLocal } from "./shift-retention";

/** Abwesenheiten mit Enddatum älter als dieser Zeitraum werden aus der DB gelöscht. */
export const ABSENCE_RETENTION_MONTHS = 12;

export const ABSENCE_PURGE_BATCH_SIZE = 1000;

/** Abwesenheiten mit `end_date` strikt vor diesem Tag werden gelöscht. */
export function absencePurgeCutoffISO(referenceDate: Date = new Date()): string {
  return toISODateLocal(
    subtractCalendarMonths(referenceDate, ABSENCE_RETENTION_MONTHS)
  );
}

export function isAbsenceEligibleForPurge(
  absence: Pick<{ end_date: string | null }, "end_date">,
  purgeCutoffISO: string
): boolean {
  if (!absence.end_date) return false;
  return absence.end_date < purgeCutoffISO;
}
