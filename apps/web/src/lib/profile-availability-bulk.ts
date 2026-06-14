import { timeToMinutes } from "@schichtwerk/database";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";

function availabilityClockEquals(a: string, b: string): boolean {
  return timeToMinutes(a) === timeToMinutes(b);
}

/** Einträge mit exakt gleichem Uhrzeit-Fenster (für Mehrfach-Ändern). */
export function availabilityEntriesMatchingWindow(
  startTime: string,
  endTime: string,
  availability: readonly ProfileRecurringAvailability[]
): ProfileRecurringAvailability[] {
  return availability.filter(
    (entry) =>
      availabilityClockEquals(entry.start_time, startTime) &&
      availabilityClockEquals(entry.end_time, endTime)
  );
}

/** Wochentage mit mindestens einem Eintrag in der Verfügbarkeitsliste. */
export function weekdaysWithListedAvailability(
  availability: readonly ProfileRecurringAvailability[]
): number[] {
  const weekdays = new Set<number>();
  for (const entry of availability) {
    weekdays.add(entry.weekday);
  }
  return [...weekdays].sort((a, b) => a - b);
}

/** Wochentage mit Verfügbarkeit für dasselbe Uhrzeit-Fenster. */
export function weekdaysWithMatchingAvailability(
  startTime: string,
  endTime: string,
  availability: readonly ProfileRecurringAvailability[]
): number[] {
  const weekdays = new Set<number>();
  for (const entry of availabilityEntriesMatchingWindow(
    startTime,
    endTime,
    availability
  )) {
    weekdays.add(entry.weekday);
  }
  return [...weekdays].sort((a, b) => a - b);
}

export function findAvailabilityForWeekdayWindow(
  weekday: number,
  startTime: string,
  endTime: string,
  availability: readonly ProfileRecurringAvailability[]
): ProfileRecurringAvailability | undefined {
  return availability.find(
    (entry) =>
      entry.weekday === weekday &&
      availabilityClockEquals(entry.start_time, startTime) &&
      availabilityClockEquals(entry.end_time, endTime)
  );
}

/** Zielzeile für Mehrfach-Ändern an einem Wochentag. */
export function findBulkEditEntryForWeekday(
  weekday: number,
  availability: readonly ProfileRecurringAvailability[],
  referenceWindow?: { start: string; end: string },
  sourceAvailabilityId?: string
): ProfileRecurringAvailability | undefined {
  const onWeekday = availability.filter((entry) => entry.weekday === weekday);
  if (onWeekday.length === 0) return undefined;

  if (onWeekday.length === 1) return onWeekday[0];

  if (sourceAvailabilityId) {
    const source = onWeekday.find((entry) => entry.id === sourceAvailabilityId);
    if (source) return source;
  }

  if (referenceWindow) {
    const byWindow = findAvailabilityForWeekdayWindow(
      weekday,
      referenceWindow.start,
      referenceWindow.end,
      availability
    );
    if (byWindow) return byWindow;
  }

  return [...onWeekday].sort(
    (a, b) =>
      a.start_time.localeCompare(b.start_time) ||
      a.end_time.localeCompare(b.end_time) ||
      a.id.localeCompare(b.id)
  )[0];
}

/** @deprecated Alias — bitte findBulkEditEntryForWeekday verwenden. */
export function resolveBulkEditTargetAvailability(
  weekday: number,
  startTime: string,
  endTime: string,
  availability: readonly ProfileRecurringAvailability[],
  sourceAvailabilityId?: string
): ProfileRecurringAvailability | undefined {
  return findBulkEditEntryForWeekday(
    weekday,
    availability,
    { start: startTime, end: endTime },
    sourceAvailabilityId
  );
}
