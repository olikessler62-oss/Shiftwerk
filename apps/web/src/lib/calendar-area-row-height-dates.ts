import { isPastCalendarDate } from "@/lib/dates";
import {
  isAreaOpenOnDate,
  type AreaServiceHourRef,
} from "@/lib/location-staffing-client";

/**
 * Steuert, welche Kalendertage in die Bereichs-Zeilenhöhe einfließen
 * (ausgeklappt + eingeklappt, Simple Planning + Tag×Bereich).
 *
 * --- REVERT-SNAPSHOT (Stand vor Ausblendung vergangener Tage) ---
 * Es zählten alle Tage in `layoutActiveDayDates`, unabhängig vom Datum:
 *
 * ```ts
 * for (const date of dates) {
 *   if (!layoutActiveDayDates.has(date)) continue;
 *   // Schichtanzahl für maxLaneCount / simplePlanningRowLayout
 * }
 * ```
 *
 * Vergangene, manuell ausgeklappte Tage mit vielen Schichten konnten die
 * gesamte Bereichszeile vergrößern; Scroll/Overflow galt auch dort.
 * --- Ende REVERT-SNAPSHOT ---
 */
export function isCalendarAreaRowHeightDate(
  dateISO: string,
  layoutActiveDayDates: ReadonlySet<string>,
  todayISO: string
): boolean {
  if (!layoutActiveDayDates.has(dateISO)) return false;
  return !isPastCalendarDate(dateISO, todayISO);
}

/**
 * Expandierter Bereich darf auf 68 px minimiert werden, wenn:
 * - ab heute bis Wochenende (sichtbare `weekDates`) weder Servicezeit noch Schichten, und
 * - in vergangenen Tagen dieser Woche keine Schichten (auch ohne Servicezeit).
 *
 * Unabhängig davon, ob der Tag in `layoutActiveDayDates` ausgeklappt ist.
 */
export function isAreaRowMinimizedFromTodayThroughWeek(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  weekDates: readonly string[],
  todayISO: string,
  shiftCountOnDate: (areaId: string, dateISO: string) => number
): boolean {
  let hasRemainderDay = false;

  for (const dateISO of weekDates) {
    if (isPastCalendarDate(dateISO, todayISO)) {
      if (shiftCountOnDate(areaId, dateISO) > 0) return false;
      continue;
    }
    hasRemainderDay = true;
    if (isAreaOpenOnDate(serviceHours, areaId, dateISO)) return false;
    if (shiftCountOnDate(areaId, dateISO) > 0) return false;
  }

  return hasRemainderDay;
}
