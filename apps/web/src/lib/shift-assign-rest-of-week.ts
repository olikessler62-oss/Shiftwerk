import { isPastCalendarDate, toISODate } from "@/lib/dates";

/** Kalendertage der sichtbaren Woche nach dem Ankertag (inkl. heute, ohne Vergangenheit davor). */
export function remainingAssignableWeekDates(
  anchorDate: string,
  weekDates: readonly string[],
  todayISO = toISODate(new Date())
): string[] {
  return weekDates.filter((date) => date > anchorDate && !isPastCalendarDate(date, todayISO));
}

export function hasRemainingAssignableWeekDates(
  anchorDate: string,
  weekDates: readonly string[],
  todayISO = toISODate(new Date())
): boolean {
  return remainingAssignableWeekDates(anchorDate, weekDates, todayISO).length > 0;
}
