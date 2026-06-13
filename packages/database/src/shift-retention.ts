/** Operative Schichtdaten: max. 13 Kalendermonate zurück (siehe Spec 006). */
export const SHIFTS_HOT_RETENTION_MONTHS = 13;

/** Gesamt-Aufbewahrung inkl. Archiv, danach Purge. */
export const SHIFTS_TOTAL_RETENTION_MONTHS = 25;

export const SHIFTS_ARCHIVE_BATCH_SIZE = 5000;

export function subtractCalendarMonths(date: Date, months: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setMonth(d.getMonth() - months);
  return d;
}

export function toISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Montag der Woche (lokal). */
export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Ältestes erlaubtes `shift_date` in der Hot-Tabelle. */
export function shiftHotCutoffISO(referenceDate: Date = new Date()): string {
  return toISODateLocal(
    subtractCalendarMonths(referenceDate, SHIFTS_HOT_RETENTION_MONTHS)
  );
}

/** Purge-Grenze: Schichten im Archiv älter als dieser Tag werden gelöscht. */
export function shiftPurgeCutoffISO(referenceDate: Date = new Date()): string {
  return toISODateLocal(
    subtractCalendarMonths(referenceDate, SHIFTS_TOTAL_RETENTION_MONTHS)
  );
}

/** Ältester erlaubter Kalenderwochen-Montag (Dashboard / Planung). */
export function earliestPlanningWeekStartISO(
  referenceDate: Date = new Date()
): string {
  const cutoff = subtractCalendarMonths(
    referenceDate,
    SHIFTS_HOT_RETENTION_MONTHS
  );
  return toISODateLocal(startOfWeekMonday(cutoff));
}

export function resolvePlanningWeekStart(
  weekStartISO: string,
  referenceDate: Date = new Date()
): { weekStart: string; clamped: boolean } {
  const earliest = earliestPlanningWeekStartISO(referenceDate);
  if (weekStartISO < earliest) {
    return { weekStart: earliest, clamped: true };
  }
  return { weekStart: weekStartISO, clamped: false };
}

/** Query-`from` nicht vor Hot-Cutoff (Defense in depth). */
export function clampShiftQueryFromDate(
  fromDate: string,
  referenceDate: Date = new Date()
): string {
  const cutoff = shiftHotCutoffISO(referenceDate);
  return fromDate < cutoff ? cutoff : fromDate;
}

export function isPlanningWeekAtEarliest(
  weekStartISO: string,
  referenceDate: Date = new Date()
): boolean {
  return weekStartISO <= earliestPlanningWeekStartISO(referenceDate);
}
