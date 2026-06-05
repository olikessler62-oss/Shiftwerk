/** Reine Hilfsfunktionen für Client-Komponenten (kein @schichtwerk/database-Import). */

export function weekdayIndexFromDate(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 ? 6 : day - 1;
}

function isValidActiveWeekdays(mask: string): boolean {
  return mask.length === 7 && /^[01]{7}$/.test(mask);
}

export function isLocationOpenOnWeekday(
  activeWeekdays: string,
  weekdayIndex: number
): boolean {
  if (!isValidActiveWeekdays(activeWeekdays)) return false;
  return activeWeekdays[weekdayIndex] === "1";
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
  locationActiveWeekdays: string
): number {
  const weekday = weekdayIndexFromDate(dateISO);
  if (!isLocationOpenOnWeekday(locationActiveWeekdays, weekday)) return 0;
  return rules
    .filter((r) => r.location_area_id === areaId && r.weekday === weekday)
    .reduce((sum, r) => sum + r.required_count, 0);
}
