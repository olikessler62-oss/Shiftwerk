/** Reine Hilfsfunktionen für Client-Komponenten (kein @schichtwerk/database-Import). */

import { resolvePresetIdFromTimes } from "@/lib/areacalendar-assignment-presets";
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

const WEEKDAY_PLURAL_KEYS = [
  "mondayPlural",
  "tuesdayPlural",
  "wednesdayPlural",
  "thursdayPlural",
  "fridayPlural",
  "saturdayPlural",
  "sundayPlural",
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

function timeSegments(
  startTime: string,
  endTime: string
): { start: number; end: number }[] {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin == null || endMin == null || startMin === endMin) return [];
  if (endMin > startMin) return [{ start: startMin, end: endMin }];
  return [
    { start: startMin, end: 24 * 60 },
    { start: 0, end: endMin },
  ];
}

function serviceHourNextWeekday(weekday: number): number {
  if (weekday >= 0 && weekday <= 6) return weekday === 6 ? 0 : weekday + 1;
  if (weekday === STAFFING_HOLIDAY_WEEKDAY) return 0;
  return weekday;
}

function isOvernightServiceHourTime(startTime: string, endTime: string): boolean {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin == null || endMin == null) return false;
  return endMin <= startMin;
}

function serviceHourPreviousWeekday(weekday: number): number {
  if (weekday >= 0 && weekday <= 6) return weekday === 0 ? 6 : weekday - 1;
  if (weekday === STAFFING_HOLIDAY_WEEKDAY) return 6;
  return weekday;
}

function overnightMorningSpillWindows(endTime: string): { start: number; end: number }[] {
  const endMin = parseTimeToMinutes(endTime);
  if (endMin == null || endMin === 0) return [];
  return [{ start: 0, end: endMin }];
}

function shiftFitsInMorningSpillWindow(
  startTime: string,
  endTime: string,
  spillEndTime: string
): boolean {
  const shiftSegments = timeSegments(startTime, endTime);
  const spillSegments = overnightMorningSpillWindows(spillEndTime);
  if (shiftSegments.length === 0 || spillSegments.length === 0) return false;
  return shiftSegments.every((shiftSegment) =>
    spillSegments.some(
      (windowSegment) =>
        shiftSegment.start >= windowSegment.start &&
        shiftSegment.end <= windowSegment.end
    )
  );
}
function shiftFitsInServiceHourWindow(
  startTime: string,
  endTime: string,
  windowStart: string,
  windowEnd: string
): boolean {
  const shiftSegments = timeSegments(startTime, endTime);
  const windowSegments = timeSegments(windowStart, windowEnd);
  if (shiftSegments.length === 0 || windowSegments.length === 0) return false;
  return shiftSegments.every((shiftSegment) =>
    windowSegments.some(
      (windowSegment) =>
        shiftSegment.start >= windowSegment.start &&
        shiftSegment.end <= windowSegment.end
    )
  );
}

export function formatServiceHourTimeRange(
  startTime: string,
  endTime: string,
  locale: WeekdayLabelLocale = "de"
): string {
  const from = startTime.slice(0, 5);
  const to = endTime.slice(0, 5);
  if (!isOvernightServiceHourTime(from, to)) {
    return formatTimeRange(from, to);
  }
  const suffix = locale === "en" ? " (+1 day)" : " (+1)";
  return `${formatTime(from)} – ${formatTime(to)}${suffix}`;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function serviceHourIdsForAreaOnDate(
  serviceHours: readonly AreaServiceHourRef[],
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
  serviceHours: readonly AreaServiceHourRef[] | null | undefined,
  areaId: string,
  dateISO: string,
  startTime: string,
  endTime: string
): string | null {
  const hours = serviceHours ?? [];
  const weekday = serviceWeekdayForDate(dateISO);
  for (const hour of hours) {
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

  const previousWeekday = serviceHourPreviousWeekday(weekday);
  for (const hour of hours) {
    if (
      hour.location_area_id !== areaId ||
      normalizeWeekday(hour.weekday) !== previousWeekday ||
      !hour.id ||
      !hour.start_time ||
      !hour.end_time ||
      !isOvernightServiceHourTime(hour.start_time, hour.end_time)
    ) {
      continue;
    }
    if (shiftFitsInMorningSpillWindow(startTime, endTime, hour.end_time)) {
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
  if (isOvernightServiceHourTime(from, to)) {
    const nextDay = weekdayLabel(serviceHourNextWeekday(hour.weekday));
    return `${day}, ${from} – ${nextDay} ${to}`;
  }
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
  templates?: readonly ServiceHourShiftTemplateRef[],
  locale: WeekdayLabelLocale = "de"
): string {
  const from = (hour.start_time ?? "00:00").slice(0, 5);
  const to = (hour.end_time ?? "00:00").slice(0, 5);
  const base = formatServiceHourTimeRange(from, to, locale);
  const templateName = templates
    ? shiftTemplateNameForServiceHour(hour, templates)
    : null;
  return templateName ? `${base} (${templateName})` : base;
}

/** Servicezeit-Fenster eines Bereichs an einem Kalendertag (sortiert nach Start). */
export function areaServiceHoursOnDate(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  dateISO: string
): Array<Pick<AreaServiceHourRef, "start_time" | "end_time">> {
  const weekday = serviceWeekdayForDate(dateISO);
  return serviceHours
    .filter(
      (hour) =>
        hour.location_area_id === areaId &&
        normalizeWeekday(hour.weekday) === weekday &&
        hour.start_time?.trim() &&
        hour.end_time?.trim()
    )
    .sort((a, b) =>
      (a.start_time ?? "").localeCompare(b.start_time ?? "")
    );
}

/** Tooltip-Text: alle Servicezeit-Fenster eines Bereichs an einem Tag (eine Zeile pro Fenster). */
export function formatAreaServiceHoursDayTooltipBody(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  dateISO: string,
  options: {
    locale?: WeekdayLabelLocale;
    shiftTemplates?: readonly ServiceHourShiftTemplateRef[];
  } = {}
): string {
  const hours = areaServiceHoursOnDate(serviceHours, areaId, dateISO);
  if (hours.length === 0) return "";
  const locale = options.locale ?? "de";
  return hours
    .map((hour) =>
      formatServiceHourStaffingTimeLabel(hour, options.shiftTemplates, locale)
    )
    .join("\n");
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
  serviceHours: readonly AreaServiceHourRef[],
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
  serviceHours: readonly AreaServiceHourRef[],
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

/** Referenzdatum für einen Wochentag (Mo=0 … So=6), ohne Feiertag. */
export function sampleDateISOForWeekday(weekday: number): string {
  const anchorDate = "2026-06-22";
  const anchorWeekday = weekdayIndexFromDate(anchorDate);
  const offset = normalizeWeekday(weekday) - anchorWeekday;
  const date = new Date(`${anchorDate}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function isAreaOpenOnDate(
  serviceHours: readonly AreaServiceHourRef[],
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
  serviceHours: readonly AreaServiceHourRef[],
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
    if (areaIds.length > 0) {
      if (!hour.location_area_id || !areaIds.includes(hour.location_area_id)) {
        return false;
      }
    }
    return normalizeServiceHourWeekday(hour.weekday) === weekday;
  });
}

/** Servicezeiten, die eine Bedarfs-Füllanzeige tragen können (wie tagAreaHeaderStaffingEntries). */
export function hasStaffingHeaderServiceHoursOnDate(
  serviceHours: readonly AreaServiceHourRef[],
  dateISO: string,
  areaId: string
): boolean {
  const weekday = serviceWeekdayForDate(dateISO);
  return serviceHours.some(
    (hour) =>
      hour.location_area_id === areaId &&
      Boolean(hour.id) &&
      Boolean(hour.start_time?.trim()) &&
      Boolean(hour.end_time?.trim()) &&
      normalizeWeekday(hour.weekday) === weekday
  );
}

/** Bereich hat am Tag planbare Servicezeit-Fenster (Start + Ende). */
export function areaHasEffectiveServiceHoursOnDate(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  dateISO: string
): boolean {
  return hasStaffingHeaderServiceHoursOnDate(serviceHours, dateISO, areaId);
}

/** Mindestens ein Bereich mit planbaren Servicezeiten am Tag. */
export function hasEffectiveServiceHoursOnDate(
  serviceHours: readonly AreaServiceHourRef[],
  dateISO: string,
  areaIds: readonly string[] = []
): boolean {
  if (areaIds.length === 0) {
    const weekday = serviceWeekdayForDate(dateISO);
    return serviceHours.some(
      (hour) =>
        Boolean(hour.id) &&
        Boolean(hour.start_time?.trim()) &&
        Boolean(hour.end_time?.trim()) &&
        normalizeServiceHourWeekday(hour.weekday) === weekday
    );
  }
  return areaIds.some((areaId) =>
    areaHasEffectiveServiceHoursOnDate(serviceHours, areaId, dateISO)
  );
}

export type StaffingRule = {
  location_area_id: string;
  service_hour_id: string;
  required_count: number;
  qualification_id?: string | null;
};

export function areaHasServiceHours(
  serviceHours: readonly AreaServiceHourRef[],
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
  serviceHours: readonly AreaServiceHourRef[]
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
  serviceHours: readonly AreaServiceHourRef[]
): boolean {
  return dates.some(
    (date) =>
      !isPastCalendarDate(date) &&
      areaHasStaffingRequirementOnDate(rules, areaId, date, serviceHours)
  );
}

/** Öffnungsstatus im Bereich-Kalender: Servicezeit oder Schichten im Bereich. */
export function isAreaOpenInCalendar(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  dateISO: string,
  hasShiftsInAreaOnDate: boolean
): boolean {
  return (
    hasShiftsInAreaOnDate ||
    isAreaOpenOnDate(serviceHours, areaId, dateISO)
  );
}

/** Mindestens ein Bereich geöffnet (Bereich-Kalender). */
export function isAnyAreaOpenInCalendar(
  serviceHours: readonly AreaServiceHourRef[],
  areaIds: readonly string[],
  dateISO: string,
  hasShiftsOnDate: boolean
): boolean {
  return (
    hasShiftsOnDate || isAnyAreaOpenOnDate(serviceHours, areaIds, dateISO)
  );
}

/** Personalbedarf an geöffneten Bereichen (Bereich-Kalender). */
export function hasStaffingRequirementInCalendar(
  rules: StaffingRule[],
  areaIds: readonly string[],
  dateISO: string,
  serviceHours: readonly AreaServiceHourRef[]
): boolean {
  return hasStaffingRequirementOnDate(rules, areaIds, dateISO, serviceHours);
}

/** Vergangener Arbeitstag (Mo–So oder Feiertag) für einen Bereich. */
export function isPastAreaWorkDayCell(
  serviceHours: readonly AreaServiceHourRef[],
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

export type StaffingConflictKind =
  | "overstaffed"
  | "qualification_mismatch"
  | "no_matching_qualification";

/** Einzelner Konflikt für Tooltip-Fußnote (wer, wann, welche Position). */
export type StaffingConflictDetail = {
  kind: Exclude<StaffingConflictKind, "overstaffed">;
  employeeName: string;
  timeLabel: string;
  assignedQualificationName?: string;
  missingQualificationName?: string;
};

/** Hinweis zur Einteilung (z. B. Überbedarf) — kein Konflikt. */
export type StaffingHintDetail = {
  kind: "overstaffed";
  employeeName: string;
  timeLabel: string;
  assignedQualificationName?: string;
};

export type StaffingAssignmentDetail = StaffingConflictDetail | StaffingHintDetail;

export type TagAreaHeaderStaffingEntry = {
  serviceHourId: string;
  label: string;
  assigned: number;
  /** Bestätigt + offene Planung — für Rot/Grün-Projektion. */
  projectedAssigned?: number;
  required: number;
  /** Ausführliches Zeitlabel (Bulk-Modal). */
  timeLabel?: string;
  /** Zeitlabel ohne Wochentag (Kalender-Overlay). */
  calendarTimeLabel?: string;
  /** Schichtvorlage, wenn Bedarfszeiten exakt einer Vorlage entsprechen. */
  shiftTemplateLabel?: string;
  /** Bedarf und Einsatz je Funktion (Bulk-Modal-Tooltip). */
  qualifications?: StaffingQualificationCoverage[];
  /** Funktions-Einsatz inkl. geplanter Schichten. */
  projectedQualifications?: StaffingQualificationCoverage[];
  /** Konkrete Qualifikations-/Zuweisungskonflikte für Kalender-Tooltip. */
  conflictDetails?: StaffingConflictDetail[];
  /** Hinweise zur Einteilung (z. B. Überbedarf) für Kalender-Tooltip. */
  hintDetails?: StaffingHintDetail[];
};

/** Personalbedarf und Einsatz je Servicezeit-Fenster für Tag-Bereich-Header (Bereich-Kalender). */
export function tagAreaHeaderStaffingEntriesInCalendar(
  rules: StaffingRule[],
  areaId: string,
  dateISO: string,
  serviceHours: readonly AreaServiceHourRef[],
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
  serviceHours: readonly AreaServiceHourRef[]
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
  serviceHours: readonly AreaServiceHourRef[]
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

/** Entfernt Leerzeichen um Bindestriche und Pipe-Symbole in Bedarfstexten. */
export function compactStaffingTimeRangeLabel(label: string): string {
  return label
    .replace(/\s*([-–—])\s*/g, "$1")
    .replace(/\s*\|\s*/g, "|")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveCalendarStaffingTimeLabel(
  entry: Pick<
    TagAreaHeaderStaffingEntry,
    "calendarTimeLabel" | "label" | "shiftTemplateLabel"
  >
): string {
  if (entry.shiftTemplateLabel?.trim()) {
    return entry.shiftTemplateLabel.trim();
  }
  const raw =
    entry.calendarTimeLabel ?? staffingLabelWithoutWeekday(entry.label);
  return compactStaffingTimeRangeLabel(raw);
}

/** Schicht- und/oder Uhrzeit für Tooltip-Zeilen (ohne äußere Klammern). */
export function resolveStaffingTooltipQualificationShiftTime(
  entry: Pick<
    TagAreaHeaderStaffingEntry,
    "shiftTemplateLabel" | "calendarTimeLabel" | "timeLabel" | "label"
  >
): string | null {
  const rawTime =
    entry.calendarTimeLabel ??
    entry.timeLabel ??
    (entry.label ? staffingLabelWithoutWeekday(entry.label) : null);
  const timePart = rawTime?.trim()
    ? compactStaffingTimeRangeLabel(rawTime.trim())
    : null;
  const shiftPart = entry.shiftTemplateLabel?.trim() || null;

  if (shiftPart && timePart) return `${shiftPart} ${timePart}`;
  if (shiftPart) return shiftPart;
  if (timePart) return timePart;
  return null;
}

export function createServiceHourStaffingLabel(
  locale: WeekdayLabelLocale = "de"
): (hour: ServiceHourStaffingRef) => string {
  return (hour) => {
    const day =
      hour.weekday === STAFFING_HOLIDAY_WEEKDAY
        ? "FT"
        : weekdayAbbrevFromIndex(hour.weekday, locale);
    return `${day} ${formatServiceHourTimeRange(hour.start_time, hour.end_time, locale)}`;
  };
}

function staffingCoverageKey(
  timeKey: string,
  rule: Pick<StaffingRule, "qualification_id">
): string {
  return `${timeKey}|${rule.qualification_id ?? ""}`;
}

/** Ordnet Personalbedarf-Regeln den Servicezeit-Fenstern eines Tages zu (auch per Uhrzeit). */
function accumulateRequiredStaffingForDayHours(
  rules: StaffingRule[],
  areaId: string,
  dayHours: readonly ServiceHourStaffingRef[],
  serviceHours: readonly AreaServiceHourRef[],
  weekday: number
): Map<string, number> {
  const requiredByHour = new Map<string, number>();
  const dayHourIds = new Set(dayHours.map((hour) => hour.id));
  const dayHourIdByTimeKey = new Map<string, string>(
    dayHours.map((hour) => [`${hour.start_time}|${hour.end_time}`, hour.id])
  );
  const areaServiceHours = serviceHours.filter(
    (hour) => hour.location_area_id === areaId
  );
  /** Fenster+Funktion, für die an diesem Tag bereits Bedarf gezählt wird. */
  const coveredStaffingKeys = new Set<string>();

  const addRequired = (
    hourId: string,
    count: number,
    timeKey: string,
    rule: StaffingRule
  ) => {
    const coverageKey = staffingCoverageKey(timeKey, rule);
    if (coveredStaffingKeys.has(coverageKey)) return;
    requiredByHour.set(hourId, (requiredByHour.get(hourId) ?? 0) + count);
    coveredStaffingKeys.add(coverageKey);
  };

  for (const rule of rules) {
    if (rule.location_area_id !== areaId) continue;
    const count = normalizeRequiredCount(rule.required_count);
    if (count <= 0) continue;

    if (dayHourIds.has(rule.service_hour_id)) {
      const hour = dayHours.find((item) => item.id === rule.service_hour_id);
      if (!hour) continue;
      addRequired(
        hour.id,
        count,
        `${hour.start_time}|${hour.end_time}`,
        rule
      );
      continue;
    }

    const ruleHour = serviceHours.find((hour) => hour.id === rule.service_hour_id);
    if (
      !ruleHour ||
      ruleHour.location_area_id !== areaId ||
      !ruleHour.start_time ||
      !ruleHour.end_time
    ) {
      continue;
    }

    const ruleStart = serviceHourTimeFieldValue(ruleHour.start_time);
    const ruleEnd = serviceHourTimeFieldValue(ruleHour.end_time);
    const timeKey = `${ruleStart}|${ruleEnd}`;

    if (coveredStaffingKeys.has(staffingCoverageKey(timeKey, rule))) continue;

    const ruleWeekday = normalizeWeekday(ruleHour.weekday);

    if (ruleWeekday === weekday) {
      const mappedHourId = dayHourIdByTimeKey.get(timeKey);
      if (mappedHourId) {
        addRequired(mappedHourId, count, timeKey, rule);
      }
      continue;
    }

    const equivalentHour = findServiceHourByWeekdayAndWindow(
      weekday,
      ruleStart,
      ruleEnd,
      areaServiceHours
    );
    if (equivalentHour?.id && dayHourIds.has(equivalentHour.id)) {
      addRequired(equivalentHour.id, count, timeKey, rule);
      continue;
    }

    const containedDayHours = dayHours.filter((hour) =>
      shiftFitsInServiceHourWindow(
        hour.start_time,
        hour.end_time,
        ruleStart,
        ruleEnd
      )
    );
    if (containedDayHours.length === 1) {
      const child = containedDayHours[0]!;
      addRequired(
        child.id,
        count,
        `${child.start_time}|${child.end_time}`,
        rule
      );
    }
  }

  return requiredByHour;
}

/** Personalbedarf und Einsatz je Servicezeit-Fenster für Tag-Bereich-Header. */
export function tagAreaHeaderStaffingEntries(
  rules: StaffingRule[],
  areaId: string,
  dateISO: string,
  serviceHours: readonly AreaServiceHourRef[],
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

  const requiredByHour = accumulateRequiredStaffingForDayHours(
    rules,
    areaId,
    dayHours,
    serviceHours,
    weekday
  );

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

export function weekdayPluralLabelFromIndex(
  weekday: number,
  t: (key: string) => string
): string {
  if (weekday === STAFFING_HOLIDAY_WEEKDAY) {
    return t("locations.weekdays.holidayPlural");
  }
  return t(`locations.weekdays.${WEEKDAY_PLURAL_KEYS[weekday]!}`);
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
  serviceHours: readonly AreaServiceHourRef[]
): AreaServiceHourRef | undefined {
  const start = serviceHourTimeFieldValue(startTime);
  const end = serviceHourTimeFieldValue(endTime);
  return serviceHours.find(
    (hour) =>
      normalizeWeekday(hour.weekday) === weekday &&
      hour.id != null &&
      hour.start_time != null &&
      hour.end_time != null &&
      serviceHourTimeFieldValue(hour.start_time) === start &&
      serviceHourTimeFieldValue(hour.end_time) === end
  );
}

/** Servicezeit für Personalbedarf-Speichern: Bedarfszeiten können schmaler als das Fenster sein. */
export function resolveServiceHourForStaffingWindow(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  dateISO: string,
  startTime: string,
  endTime: string,
  options?: { referenceServiceHourId?: string }
): string | null {
  const weekday = serviceWeekdayForDate(dateISO);

  if (options?.referenceServiceHourId) {
    const reference = serviceHours.find(
      (hour) => hour.id === options.referenceServiceHourId
    );
    if (reference?.id) {
      if (normalizeWeekday(reference.weekday) === weekday) {
        return reference.id;
      }
      const equivalent = findServiceHourByWeekdayAndWindow(
        weekday,
        reference.start_time ?? "",
        reference.end_time ?? "",
        serviceHours
      );
      if (equivalent?.id) return equivalent.id;
    }
  }

  const exact = findServiceHourByWeekdayAndWindow(
    weekday,
    startTime,
    endTime,
    serviceHours
  );
  if (exact?.id) return exact.id;

  return findServiceHourIdForShift(
    serviceHours,
    areaId,
    dateISO,
    startTime,
    endTime
  );
}
