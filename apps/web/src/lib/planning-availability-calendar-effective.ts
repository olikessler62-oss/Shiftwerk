import type { ProfileRecurringAvailability } from "@schichtwerk/types";

/** Aktuelle und künftige Kalendertage nutzen die live hinterlegten Verfügbarkeiten. */
export function shouldApplyCurrentAvailabilityToCalendarDate(
  dateISO: string,
  todayISO: string
): boolean {
  return dateISO >= todayISO;
}

function endOfCalendarDayUtcMs(dateISO: string): number {
  return Date.parse(`${dateISO}T23:59:59.999Z`);
}

/**
 * Vergangene Tage: nur Verfügbarkeiten, die am betreffenden Tag bereits existierten
 * (created_at). Neu hinzugefügte Regeln wirken nicht rückwirkend auf vergangene Zellen.
 */
export function recurringAvailabilityEffectiveOnCalendarDate(
  availability: readonly ProfileRecurringAvailability[],
  dateISO: string,
  todayISO: string
): ProfileRecurringAvailability[] {
  if (shouldApplyCurrentAvailabilityToCalendarDate(dateISO, todayISO)) {
    return [...availability];
  }

  const endOfDayMs = endOfCalendarDayUtcMs(dateISO);
  return availability.filter((slot) => {
    const createdMs = Date.parse(slot.created_at);
    return Number.isFinite(createdMs) && createdMs <= endOfDayMs;
  });
}
