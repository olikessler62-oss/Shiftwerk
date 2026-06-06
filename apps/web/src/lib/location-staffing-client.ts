/** Reine Hilfsfunktionen für Client-Komponenten (kein @schichtwerk/database-Import). */

export const STAFFING_HOLIDAY_WEEKDAY = 7;

export function weekdayIndexFromDate(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 ? 6 : day - 1;
}

export type AreaServiceHourRef = {
  location_area_id: string;
  weekday: number;
};

export function isAreaOpenOnWeekday(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  weekday: number
): boolean {
  return serviceHours.some(
    (h) => h.location_area_id === areaId && h.weekday === weekday
  );
}

export function isStaffingDayEnabled(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  weekday: number
): boolean {
  return isAreaOpenOnWeekday(serviceHours, areaId, weekday);
}

export type StaffingRule = {
  location_area_id: string;
  shift_type_id: string;
  weekday: number;
  required_count: number;
};

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
