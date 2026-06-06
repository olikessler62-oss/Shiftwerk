import {
  isAreaOpenOnWeekday,
  type AreaServiceHourRef,
} from "./location-service-hours";

/** Montag = 0 … Sonntag = 6, Feiertage = 7 */
export const STAFFING_HOLIDAY_WEEKDAY = 7;

/** Montag = 0 … Sonntag = 6 (ISO-Woche) */
export function weekdayIndexFromDate(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 ? 6 : day - 1;
}

export type StaffingRule = {
  location_area_id: string;
  shift_type_id: string;
  weekday: number;
  required_count: number;
};

/** Summe aller Bedarfsregeln für Bereich + Kalendertag (nur wenn Bereich geöffnet). */
export function requiredStaffForAreaOnDate(
  rules: StaffingRule[],
  areaId: string,
  dateISO: string,
  serviceHours: AreaServiceHourRef[]
): number {
  const weekday = weekdayIndexFromDate(dateISO);
  if (!isAreaOpenOnWeekday(serviceHours, areaId, weekday)) return 0;
  return rules
    .filter((r) => r.location_area_id === areaId && r.weekday === weekday)
    .reduce((sum, r) => sum + r.required_count, 0);
}
