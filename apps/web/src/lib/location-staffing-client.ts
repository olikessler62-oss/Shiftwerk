/** Reine Hilfsfunktionen für Client-Komponenten (kein @schichtwerk/database-Import). */

import { isPastCalendarDate } from "@/lib/dates";
import { isGermanPublicHoliday } from "@/lib/german-public-holidays";
import { shortenShiftTypeDisplayName } from "@/lib/profile-availability-label";

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

/** Wochentag für Service-Zeiten: an Feiertagen Spalte 7, sonst Mo=0 … So=6. */
export function serviceWeekdayForDate(isoDate: string): number {
  if (isGermanPublicHoliday(isoDate)) return STAFFING_HOLIDAY_WEEKDAY;
  return weekdayIndexFromDate(isoDate);
}

export function isAreaOpenOnDate(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  dateISO: string
): boolean {
  return isAreaOpenOnWeekday(
    serviceHours,
    areaId,
    serviceWeekdayForDate(dateISO)
  );
}

export function isAnyAreaOpenOnDate(
  serviceHours: AreaServiceHourRef[],
  areaIds: readonly string[],
  dateISO: string
): boolean {
  return areaIds.some((areaId) =>
    isAreaOpenOnDate(serviceHours, areaId, dateISO)
  );
}

export type StaffingRule = {
  location_area_id: string;
  shift_type_id: string;
  weekday: number;
  required_count: number;
};

export function areaHasServiceHours(
  serviceHours: AreaServiceHourRef[],
  areaId: string
): boolean {
  return serviceHours.some((hour) => hour.location_area_id === areaId);
}

/** Personalbedarf für einen Bereich an mindestens einem Wochentag. */
export function areaHasStaffingRequirement(
  rules: StaffingRule[],
  areaId: string
): boolean {
  return rules.some(
    (rule) => rule.location_area_id === areaId && rule.required_count > 0
  );
}

/** Personalbedarf für einen Bereich an einem konkreten Tag (aktuelle Regeln). */
export function areaHasStaffingRequirementOnDate(
  rules: StaffingRule[],
  areaId: string,
  dateISO: string,
  serviceHours: AreaServiceHourRef[]
): boolean {
  const weekday = serviceWeekdayForDate(dateISO);
  if (!isAreaOpenOnWeekday(serviceHours, areaId, weekday)) return false;
  return rules.some(
    (rule) =>
      rule.location_area_id === areaId &&
      rule.weekday === weekday &&
      rule.required_count > 0
  );
}

/** Personalbedarf in der sichtbaren Woche ab heute (nicht rückwirkend). */
export function areaHasStaffingRequirementInWeek(
  rules: StaffingRule[],
  areaId: string,
  dates: readonly string[],
  serviceHours: AreaServiceHourRef[]
): boolean {
  return dates.some(
    (date) =>
      !isPastCalendarDate(date) &&
      areaHasStaffingRequirementOnDate(rules, areaId, date, serviceHours)
  );
}

/** Öffnungsstatus im Dashboard: Vergangenheit nur anhand geplanter Schichten. */
export function isAreaOpenInCalendar(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  dateISO: string,
  hasShiftsInAreaOnDate: boolean
): boolean {
  if (isPastCalendarDate(dateISO)) return hasShiftsInAreaOnDate;
  return isAreaOpenOnDate(serviceHours, areaId, dateISO);
}

/** Mindestens ein Bereich geöffnet (Dashboard, ohne Rückwirkung). */
export function isAnyAreaOpenInCalendar(
  serviceHours: AreaServiceHourRef[],
  areaIds: readonly string[],
  dateISO: string,
  hasShiftsOnDate: boolean
): boolean {
  if (isPastCalendarDate(dateISO)) return hasShiftsOnDate;
  return isAnyAreaOpenOnDate(serviceHours, areaIds, dateISO);
}

/** Personalbedarf an geöffneten Bereichen (Dashboard, ohne Rückwirkung). */
export function hasStaffingRequirementInCalendar(
  rules: StaffingRule[],
  areaIds: readonly string[],
  dateISO: string,
  serviceHours: AreaServiceHourRef[]
): boolean {
  if (isPastCalendarDate(dateISO)) return false;
  return hasStaffingRequirementOnDate(rules, areaIds, dateISO, serviceHours);
}

/** Personalbedarf und Einsatz je Schichtart für Tag-Bereich-Header (Dashboard). */
export function tagAreaHeaderStaffingEntriesInCalendar(
  rules: StaffingRule[],
  areaId: string,
  dateISO: string,
  serviceHours: AreaServiceHourRef[],
  shiftTypes: ShiftTypeStaffingRef[],
  assignedShifts: { shiftTypeId: string }[]
): TagAreaHeaderStaffingEntry[] {
  if (isPastCalendarDate(dateISO)) return [];
  return tagAreaHeaderStaffingEntries(
    rules,
    areaId,
    dateISO,
    serviceHours,
    shiftTypes,
    assignedShifts
  );
}

/** Personalbedarf an mindestens einem geöffneten Bereich an diesem Tag. */
export function hasStaffingRequirementOnDate(
  rules: StaffingRule[],
  areaIds: readonly string[],
  dateISO: string,
  serviceHours: AreaServiceHourRef[]
): boolean {
  const weekday = serviceWeekdayForDate(dateISO);
  for (const areaId of areaIds) {
    if (!isAreaOpenOnWeekday(serviceHours, areaId, weekday)) continue;
    const hasRule = rules.some(
      (rule) =>
        rule.location_area_id === areaId &&
        rule.weekday === weekday &&
        rule.required_count > 0
    );
    if (hasRule) return true;
  }
  return false;
}

export function requiredStaffForAreaOnDate(
  rules: StaffingRule[],
  areaId: string,
  dateISO: string,
  serviceHours: AreaServiceHourRef[]
): number {
  const weekday = serviceWeekdayForDate(dateISO);
  if (!isAreaOpenOnWeekday(serviceHours, areaId, weekday)) return 0;
  return rules
    .filter((r) => r.location_area_id === areaId && r.weekday === weekday)
    .reduce((sum, r) => sum + r.required_count, 0);
}

export type ShiftTypeStaffingRef = {
  id: string;
  name: string;
  start_time: string;
};

export type TagAreaHeaderStaffingEntry = {
  shiftTypeId: string;
  label: string;
  assigned: number;
  required: number;
};

/** Personalbedarf und Einsatz je Schichtart für Tag-Bereich-Header. */
export function tagAreaHeaderStaffingEntries(
  rules: StaffingRule[],
  areaId: string,
  dateISO: string,
  serviceHours: AreaServiceHourRef[],
  shiftTypes: ShiftTypeStaffingRef[],
  assignedShifts: { shiftTypeId: string }[]
): TagAreaHeaderStaffingEntry[] {
  const weekday = serviceWeekdayForDate(dateISO);
  if (!isAreaOpenOnWeekday(serviceHours, areaId, weekday)) return [];

  const requiredByType = new Map<string, number>();
  for (const rule of rules) {
    if (rule.location_area_id !== areaId || rule.weekday !== weekday) continue;
    requiredByType.set(
      rule.shift_type_id,
      (requiredByType.get(rule.shift_type_id) ?? 0) + rule.required_count
    );
  }

  const assignedByType = new Map<string, number>();
  for (const shift of assignedShifts) {
    assignedByType.set(
      shift.shiftTypeId,
      (assignedByType.get(shift.shiftTypeId) ?? 0) + 1
    );
  }

  const entries: TagAreaHeaderStaffingEntry[] = [];
  for (const type of shiftTypes) {
    const required = requiredByType.get(type.id) ?? 0;
    if (required <= 0) continue;
    entries.push({
      shiftTypeId: type.id,
      label: shortenShiftTypeDisplayName(type.name),
      assigned: assignedByType.get(type.id) ?? 0,
      required,
    });
  }
  return entries;
}
