/** Reine Hilfsfunktionen für Client-Komponenten (kein @schichtwerk/database-Import). */

import { resolvePresetIdFromTimes } from "@/lib/dashboard-assignment-presets";
import { isPastCalendarDate } from "@/lib/dates";
import { isGermanPublicHoliday } from "@/lib/german-public-holidays";
import { formatTimeRange } from "@/lib/planning-utils";
import {
  weekdayAbbrevFromIndex,
  type WeekdayLabelLocale,
} from "@schichtwerk/i18n";
import type { AreaShiftTemplate } from "@schichtwerk/types";

export const STAFFING_HOLIDAY_WEEKDAY = 7;

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export function weekdayIndexFromDate(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 ? 6 : day - 1;
}

export function normalizeServiceHourWeekday(value: number | string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : -1;
}

export type AreaServiceHourRef = {
  id?: string;
  location_area_id: string;
  weekday: number;
  start_time?: string;
  end_time?: string;
};

function normalizeWeekday(value: number | string): number {
  return normalizeServiceHourWeekday(value);
}

function normalizeRequiredCount(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim().slice(0, 5);
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return null;
  const [h, m] = trimmed.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function shiftFitsInServiceHourWindow(
  startTime: string,
  endTime: string,
  windowStart: string,
  windowEnd: string
): boolean {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  const windowStartMin = parseTimeToMinutes(windowStart);
  const windowEndMin = parseTimeToMinutes(windowEnd);
  if (
    startMin == null ||
    endMin == null ||
    windowStartMin == null ||
    windowEndMin == null
  ) {
    return false;
  }
  if (endMin <= startMin) return false;
  return startMin >= windowStartMin && endMin <= windowEndMin;
}

export function serviceHourIdsForAreaOnDate(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  dateISO: string
): Set<string> {
  const weekday = serviceWeekdayForDate(dateISO);
  return new Set(
    serviceHours
      .filter(
        (hour) =>
          hour.location_area_id === areaId &&
          normalizeWeekday(hour.weekday) === weekday &&
          hour.id
      )
      .map((hour) => hour.id as string)
  );
}

export function findServiceHourIdForShift(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  dateISO: string,
  startTime: string,
  endTime: string
): string | null {
  const weekday = serviceWeekdayForDate(dateISO);
  for (const hour of serviceHours) {
    if (
      hour.location_area_id !== areaId ||
      normalizeWeekday(hour.weekday) !== weekday ||
      !hour.id ||
      !hour.start_time ||
      !hour.end_time
    ) {
      continue;
    }
    if (
      shiftFitsInServiceHourWindow(
        startTime,
        endTime,
        hour.start_time,
        hour.end_time
      )
    ) {
      return hour.id;
    }
  }
  return null;
}

export function formatServiceHourLabel(
  hour: Pick<AreaServiceHourRef, "weekday" | "start_time" | "end_time">,
  weekdayLabel: (weekday: number) => string
): string {
  const day =
    hour.weekday === STAFFING_HOLIDAY_WEEKDAY
      ? weekdayLabel(STAFFING_HOLIDAY_WEEKDAY)
      : weekdayLabel(hour.weekday);
  const from = (hour.start_time ?? "00:00").slice(0, 5);
  const to = (hour.end_time ?? "00:00").slice(0, 5);
  return `${day}, ${formatTimeRange(from, to)}`;
}

type ServiceHourShiftTemplateRef = Pick<
  AreaShiftTemplate,
  "id" | "name" | "start_time" | "end_time"
>;

export function shiftTemplateNameForServiceHour(
  hour: Pick<AreaServiceHourRef, "start_time" | "end_time">,
  templates: readonly ServiceHourShiftTemplateRef[]
): string | null {
  const templateId = resolvePresetIdFromTimes(
    hour.start_time ?? "00:00",
    hour.end_time ?? "00:00",
    templates
  );
  if (!templateId) return null;
  return templates.find((template) => template.id === templateId)?.name ?? null;
}

/** Servicezeit in der Personalbedarf-Liste, optional mit passender Schichtvorlage. */
export function formatServiceHourStaffingListLabel(
  hour: Pick<AreaServiceHourRef, "weekday" | "start_time" | "end_time">,
  weekdayLabel: (weekday: number) => string,
  templates?: readonly ServiceHourShiftTemplateRef[]
): string {
  const base = formatServiceHourLabel(hour, weekdayLabel);
  const templateName = templates
    ? shiftTemplateNameForServiceHour(hour, templates)
    : null;
  return templateName ? `${base} (${templateName})` : base;
}

export function formatServiceHourStaffingDayLabel(
  hour: Pick<AreaServiceHourRef, "weekday">,
  weekdayLabel: (weekday: number) => string
): string {
  return hour.weekday === STAFFING_HOLIDAY_WEEKDAY
    ? weekdayLabel(STAFFING_HOLIDAY_WEEKDAY)
    : weekdayLabel(hour.weekday);
}

export function formatServiceHourStaffingTimeLabel(
  hour: Pick<AreaServiceHourRef, "start_time" | "end_time">,
  templates?: readonly ServiceHourShiftTemplateRef[]
): string {
  const from = (hour.start_time ?? "00:00").slice(0, 5);
  const to = (hour.end_time ?? "00:00").slice(0, 5);
  const base = formatTimeRange(from, to);
  const templateName = templates
    ? shiftTemplateNameForServiceHour(hour, templates)
    : null;
  return templateName ? `${base} (${templateName})` : base;
}

export function staffingQualificationLabelsForHour(
  serviceHourId: string,
  staffing: readonly { service_hour_id: string; qualification_id: string; required_count: number }[],
  qualificationNameById: ReadonlyMap<string, string>
): string[] {
  return staffing
    .filter(
      (rule) =>
        rule.service_hour_id === serviceHourId && rule.required_count > 0
    )
    .map((rule) => {
      const name = qualificationNameById.get(rule.qualification_id);
      if (!name) return null;
      return { name, count: rule.required_count };
    })
    .filter((entry): entry is { name: string; count: number } => !!entry)
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    )
    .map(({ count, name }) => `${count} ${name}`);
}

export function isAreaOpenOnWeekday(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  weekday: number
): boolean {
  return serviceHours.some(
    (hour) =>
      hour.location_area_id === areaId &&
      normalizeWeekday(hour.weekday) === weekday
  );
}

export function isStaffingDayEnabled(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  weekday: number
): boolean {
  return isAreaOpenOnWeekday(serviceHours, areaId, weekday);
}

/** Wochentag für Servicezeiten: an Feiertagen Spalte 7, sonst Mo=0 … So=6. */
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

/** Mindestens ein Servicezeit-Fenster für den Kalendertag (optional auf Bereiche begrenzt). */
export function hasServiceHoursOnDate(
  serviceHours: readonly AreaServiceHourRef[],
  dateISO: string,
  areaIds: readonly string[] = []
): boolean {
  const weekday = serviceWeekdayForDate(dateISO);
  return serviceHours.some((hour) => {
    if (
      areaIds.length > 0 &&
      hour.location_area_id &&
      !areaIds.includes(hour.location_area_id)
    ) {
      return false;
    }
    return normalizeServiceHourWeekday(hour.weekday) === weekday;
  });
}

export type StaffingRule = {
  location_area_id: string;
  service_hour_id: string;
  required_count: number;
};

export function areaHasServiceHours(
  serviceHours: AreaServiceHourRef[],
  areaId: string
): boolean {
  return serviceHours.some((hour) => hour.location_area_id === areaId);
}

/** Personalbedarf für einen Bereich an mindestens einem Servicezeit-Fenster. */
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
  const hourIds = serviceHourIdsForAreaOnDate(serviceHours, areaId, dateISO);
  if (hourIds.size === 0) return false;
  return rules.some(
    (rule) =>
      rule.location_area_id === areaId &&
      hourIds.has(rule.service_hour_id) &&
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

export type ServiceHourStaffingRef = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

export type StaffingQualificationCoverage = {
  qualificationId: string;
  name: string;
  assigned: number;
  required: number;
};

export type TagAreaHeaderStaffingEntry = {
  serviceHourId: string;
  label: string;
  assigned: number;
  required: number;
  /** Ausführliches Zeitlabel (Bulk-Modal). */
  timeLabel?: string;
  /** Zeitlabel ohne Wochentag (Kalender-Overlay). */
  calendarTimeLabel?: string;
  /** Bedarf und Einsatz je Funktion (Bulk-Modal-Tooltip). */
  qualifications?: StaffingQualificationCoverage[];
};

/** Personalbedarf und Einsatz je Servicezeit-Fenster für Tag-Bereich-Header (Dashboard). */
export function tagAreaHeaderStaffingEntriesInCalendar(
  rules: StaffingRule[],
  areaId: string,
  dateISO: string,
  serviceHours: AreaServiceHourRef[],
  assignedShifts: { startTime: string; endTime: string }[],
  options: {
    formatLabel?: (hour: ServiceHourStaffingRef) => string;
    locale?: WeekdayLabelLocale;
  } = {}
): TagAreaHeaderStaffingEntry[] {
  return tagAreaHeaderStaffingEntries(
    rules,
    areaId,
    dateISO,
    serviceHours,
    assignedShifts,
    options
  );
}

/** Personalbedarf an mindestens einem geöffneten Bereich an diesem Tag. */
export function hasStaffingRequirementOnDate(
  rules: StaffingRule[],
  areaIds: readonly string[],
  dateISO: string,
  serviceHours: AreaServiceHourRef[]
): boolean {
  for (const areaId of areaIds) {
    if (areaHasStaffingRequirementOnDate(rules, areaId, dateISO, serviceHours)) {
      return true;
    }
  }
  return false;
}

export function requiredStaffForAreaOnDate(
  rules: StaffingRule[],
  areaId: string,
  dateISO: string,
  serviceHours: AreaServiceHourRef[]
): number {
  const hourIds = serviceHourIdsForAreaOnDate(serviceHours, areaId, dateISO);
  if (hourIds.size === 0) return 0;
  return rules
    .filter(
      (rule) =>
        rule.location_area_id === areaId && hourIds.has(rule.service_hour_id)
    )
    .reduce((sum, rule) => sum + normalizeRequiredCount(rule.required_count), 0);
}

/** Entfernt Wochentags-Kürzel aus dem kompakten Servicezeit-Label (z. B. „Do 08:00–10:00“). */
export function staffingLabelWithoutWeekday(label: string): string {
  const trimmed = label.trim();
  const spaceIndex = trimmed.indexOf(" ");
  return spaceIndex > 0 ? trimmed.slice(spaceIndex + 1).trim() : trimmed;
}

export function resolveCalendarStaffingTimeLabel(
  entry: Pick<TagAreaHeaderStaffingEntry, "calendarTimeLabel" | "label">
): string {
  return entry.calendarTimeLabel ?? staffingLabelWithoutWeekday(entry.label);
}

export function createServiceHourStaffingLabel(
  locale: WeekdayLabelLocale = "de"
): (hour: ServiceHourStaffingRef) => string {
  return (hour) => {
    const day =
      hour.weekday === STAFFING_HOLIDAY_WEEKDAY
        ? "FT"
        : weekdayAbbrevFromIndex(hour.weekday, locale);
    return `${day} ${formatTimeRange(hour.start_time, hour.end_time)}`;
  };
}

/** Personalbedarf und Einsatz je Servicezeit-Fenster für Tag-Bereich-Header. */
export function tagAreaHeaderStaffingEntries(
  rules: StaffingRule[],
  areaId: string,
  dateISO: string,
  serviceHours: AreaServiceHourRef[],
  assignedShifts: { startTime: string; endTime: string }[],
  options: {
    formatLabel?: (hour: ServiceHourStaffingRef) => string;
    locale?: WeekdayLabelLocale;
  } = {}
): TagAreaHeaderStaffingEntry[] {
  const formatLabel =
    options.formatLabel ??
    createServiceHourStaffingLabel(options.locale ?? "de");
  const weekday = serviceWeekdayForDate(dateISO);
  const dayHours = serviceHours
    .filter(
      (hour) =>
        hour.location_area_id === areaId &&
        normalizeWeekday(hour.weekday) === weekday &&
        hour.id &&
        hour.start_time &&
        hour.end_time
    )
    .map(
      (hour): ServiceHourStaffingRef => ({
        id: hour.id as string,
        weekday: normalizeWeekday(hour.weekday),
        start_time: hour.start_time!.slice(0, 5),
        end_time: hour.end_time!.slice(0, 5),
      })
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  if (dayHours.length === 0) return [];

  const requiredByHour = new Map<string, number>();
  for (const rule of rules) {
    if (rule.location_area_id !== areaId) continue;
    const count = normalizeRequiredCount(rule.required_count);
    if (count <= 0) continue;
    requiredByHour.set(
      rule.service_hour_id,
      (requiredByHour.get(rule.service_hour_id) ?? 0) + count
    );
  }

  const assignedByHour = new Map<string, number>();
  for (const shift of assignedShifts) {
    const hourId = findServiceHourIdForShift(
      serviceHours,
      areaId,
      dateISO,
      shift.startTime,
      shift.endTime
    );
    if (!hourId) continue;
    assignedByHour.set(hourId, (assignedByHour.get(hourId) ?? 0) + 1);
  }

  const entries: TagAreaHeaderStaffingEntry[] = [];
  for (const hour of dayHours) {
    const required = requiredByHour.get(hour.id) ?? 0;
    if (required <= 0) continue;
    entries.push({
      serviceHourId: hour.id,
      label: formatLabel(hour),
      assigned: assignedByHour.get(hour.id) ?? 0,
      required,
    });
  }

  return entries;
}

/** Kräftige Farben als Hex — Tailwind-Klassen aus Maps werden sonst nicht generiert. */
const STAFFING_WEEKDAY_COLOR: Record<number, string> = {
  0: "#06b6d4", // Montag — Türkis
  1: "#2563eb", // Dienstag — Blau
  2: "#7c3aed", // Mittwoch — Violett
  3: "#f97316", // Donnerstag — Orange
  4: "#ef4444", // Freitag — Rot
  5: "#d97706", // Samstag — Ocker
  6: "#65a30d", // Sonntag — Kräftiges Grün
  [STAFFING_HOLIDAY_WEEKDAY]: "#db2777", // Feiertag — Pink
};

export function staffingWeekdayColor(weekday: number): string {
  return STAFFING_WEEKDAY_COLOR[weekday] ?? "#2563eb";
}

export function weekdayLabelFromIndex(
  weekday: number,
  t: (key: string) => string
): string {
  if (weekday === STAFFING_HOLIDAY_WEEKDAY) {
    return t("locations.weekdays.holiday");
  }
  return t(`locations.weekdays.${WEEKDAY_KEYS[weekday]!}`);
}

function serviceHourTimeFieldValue(time: string): string {
  return time.slice(0, 5);
}

/** Wochentage mit Personalbedarf für dasselbe Uhrzeit-Fenster (Bulk-Ändern). */
export function staffedWeekdaysMatchingWindow(
  startTime: string,
  endTime: string,
  serviceHours: readonly {
    id: string;
    weekday: number;
    start_time: string;
    end_time: string;
  }[],
  staffing: readonly { service_hour_id: string; required_count: number }[]
): number[] {
  const start = serviceHourTimeFieldValue(startTime);
  const end = serviceHourTimeFieldValue(endTime);
  const staffedIds = new Set(
    staffing
      .filter((rule) => rule.required_count > 0)
      .map((rule) => rule.service_hour_id)
  );
  const weekdays = new Set<number>();
  for (const hour of serviceHours) {
    if (
      staffedIds.has(hour.id) &&
      serviceHourTimeFieldValue(hour.start_time) === start &&
      serviceHourTimeFieldValue(hour.end_time) === end
    ) {
      weekdays.add(hour.weekday);
    }
  }
  return [...weekdays].sort((a, b) => a - b);
}

export function findServiceHourByWeekdayAndWindow(
  weekday: number,
  startTime: string,
  endTime: string,
  serviceHours: readonly {
    id: string;
    weekday: number;
    start_time: string;
    end_time: string;
  }[]
) {
  const start = serviceHourTimeFieldValue(startTime);
  const end = serviceHourTimeFieldValue(endTime);
  return serviceHours.find(
    (hour) =>
      hour.weekday === weekday &&
      serviceHourTimeFieldValue(hour.start_time) === start &&
      serviceHourTimeFieldValue(hour.end_time) === end
  );
}
