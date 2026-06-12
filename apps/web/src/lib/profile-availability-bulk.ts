import type { ProfileRecurringAvailability } from "@schichtwerk/types";

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

/** Einträge mit exakt gleichem Uhrzeit-Fenster (für Mehrfach-Ändern). */
export function availabilityEntriesMatchingWindow(
  startTime: string,
  endTime: string,
  availability: readonly ProfileRecurringAvailability[]
): ProfileRecurringAvailability[] {
  const start = timeFieldValue(startTime);
  const end = timeFieldValue(endTime);
  return availability.filter(
    (entry) =>
      timeFieldValue(entry.start_time) === start &&
      timeFieldValue(entry.end_time) === end
  );
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
  const start = timeFieldValue(startTime);
  const end = timeFieldValue(endTime);
  return availability.find(
    (entry) =>
      entry.weekday === weekday &&
      timeFieldValue(entry.start_time) === start &&
      timeFieldValue(entry.end_time) === end
  );
}
