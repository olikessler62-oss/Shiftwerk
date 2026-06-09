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

function normalizeWeekday(value: number | string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : -1;
}

function normalizeRequiredCount(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isAreaOpenOnWeekday(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  weekday: number
): boolean {
  return serviceHours.some(
    (h) =>
      h.location_area_id === areaId &&
      normalizeWeekday(h.weekday) === weekday
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
    (rule) =>
      rule.location_area_id === areaId &&
      normalizeRequiredCount(rule.required_count) > 0
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
      normalizeWeekday(rule.weekday) === weekday &&
      normalizeRequiredCount(rule.required_count) > 0
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

/** Öffnungsstatus im Dashboard: Vergangenheit = Arbeitstag laut Arbeitszeit oder Schicht. */
export function isAreaOpenInCalendar(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  dateISO: string,
  hasShiftsInAreaOnDate: boolean
): boolean {
  if (isPastCalendarDate(dateISO)) {
    return (
      hasShiftsInAreaOnDate ||
      isAreaOpenOnDate(serviceHours, areaId, dateISO)
    );
  }
  return isAreaOpenOnDate(serviceHours, areaId, dateISO);
}

/** Mindestens ein Bereich geöffnet (Dashboard). */
export function isAnyAreaOpenInCalendar(
  serviceHours: AreaServiceHourRef[],
  areaIds: readonly string[],
  dateISO: string,
  hasShiftsOnDate: boolean
): boolean {
  if (isPastCalendarDate(dateISO)) {
    return hasShiftsOnDate || isAnyAreaOpenOnDate(serviceHours, areaIds, dateISO);
  }
  return isAnyAreaOpenOnDate(serviceHours, areaIds, dateISO);
}

/** Personalbedarf an geöffneten Bereichen (Dashboard). */
export function hasStaffingRequirementInCalendar(
  rules: StaffingRule[],
  areaIds: readonly string[],
  dateISO: string,
  serviceHours: AreaServiceHourRef[]
): boolean {
  return hasStaffingRequirementOnDate(rules, areaIds, dateISO, serviceHours);
}

/** Vergangener Arbeitstag (Mo–So oder Feiertag) für einen Bereich. */
export function isPastAreaWorkDayCell(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  dateISO: string,
  isManualAssignmentDay: boolean
): boolean {
  if (!isPastCalendarDate(dateISO)) return false;
  return (
    isManualAssignmentDay || isAreaOpenOnDate(serviceHours, areaId, dateISO)
  );
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
        normalizeWeekday(rule.weekday) === weekday &&
        normalizeRequiredCount(rule.required_count) > 0
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
    .filter(
      (r) =>
        r.location_area_id === areaId && normalizeWeekday(r.weekday) === weekday
    )
    .reduce((sum, r) => sum + normalizeRequiredCount(r.required_count), 0);
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
    if (
      rule.location_area_id !== areaId ||
      normalizeWeekday(rule.weekday) !== weekday
    ) {
      continue;
    }
    const count = normalizeRequiredCount(rule.required_count);
    if (count <= 0) continue;
    requiredByType.set(
      rule.shift_type_id,
      (requiredByType.get(rule.shift_type_id) ?? 0) + count
    );
  }

  const assignedByType = new Map<string, number>();
  for (const shift of assignedShifts) {
    assignedByType.set(
      shift.shiftTypeId,
      (assignedByType.get(shift.shiftTypeId) ?? 0) + 1
    );
  }

  const shiftTypeById = new Map(shiftTypes.map((type) => [type.id, type]));
  const sortIndex = new Map(shiftTypes.map((type, index) => [type.id, index]));

  const entries: TagAreaHeaderStaffingEntry[] = [];
  for (const [shiftTypeId, required] of requiredByType) {
    if (required <= 0) continue;
    const type = shiftTypeById.get(shiftTypeId);
    entries.push({
      shiftTypeId,
      label: shortenShiftTypeDisplayName(type?.name ?? "Schicht"),
      assigned: assignedByType.get(shiftTypeId) ?? 0,
      required,
    });
  }

  entries.sort((a, b) => {
    const aIndex = sortIndex.get(a.shiftTypeId) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = sortIndex.get(b.shiftTypeId) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });

  return entries;
}
