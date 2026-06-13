import {
  getBreakRuleFromCompliance,
  getPublicHolidayNameForCountry,
  getRule,
  isPublicHolidayForCountry,
  loadCompliancePresetForOrganization,
  type ComplianceEnforcementPoint,
  type CountryCompliance,
} from "@schichtwerk/compliance";
import type { ShiftTypeBreakInput } from "./interface";
import { DEFAULT_ORGANIZATION_TIME_ZONE } from "./organization-timezone";
import { timeToMinutes } from "./profile-availability-validation";

export const DEFAULT_COUNTRY_CODE = "DE";

const MINUTES_PER_DAY = 24 * 60;

function shiftWindowMinutes(
  start_time: string,
  end_time: string
): { startM: number; endM: number } {
  const startM = timeToMinutes(start_time);
  let endM = timeToMinutes(end_time);
  if (endM <= startM) endM += MINUTES_PER_DAY;
  return { startM, endM };
}

function shiftDurationMinutes(start_time: string, end_time: string): number {
  const { startM, endM } = shiftWindowMinutes(start_time, end_time);
  return endM - startM;
}

function shiftDurationHours(start_time: string, end_time: string): number {
  return shiftDurationMinutes(start_time, end_time) / 60;
}

export type BreakDurationRule = {
  kind: "max" | "required" | "none";
  minutes: number;
  minSegmentMinutes?: number;
};

export function resolveCompliance(countryCode: string | null | undefined): CountryCompliance {
  return loadCompliancePresetForOrganization(countryCode ?? DEFAULT_COUNTRY_CODE);
}

/** Schichtwerk: Montag = 0 … Sonntag = 6 → JS getDay(): So = 0 … Sa = 6 */
function toJsWeekday(weekdayMondayZero: number): number {
  return weekdayMondayZero === 6 ? 0 : weekdayMondayZero + 1;
}

function isWorkdayForRule(
  weekdayMondayZero: number,
  rule: { weekdays?: number[]; workdayDefinition?: string }
): boolean {
  const jsDay = toJsWeekday(weekdayMondayZero);
  if (rule.weekdays?.length) {
    return rule.weekdays.includes(jsDay);
  }
  if (rule.workdayDefinition === "mon_sat") {
    return jsDay >= 1 && jsDay <= 6;
  }
  if (rule.workdayDefinition === "mon_fri") {
    return jsDay >= 1 && jsDay <= 5;
  }
  return true;
}

export function getBreakDurationRuleForCountry(
  countryCode: string | null | undefined,
  start_time: string,
  end_time: string
): BreakDurationRule {
  const compliance = resolveCompliance(countryCode);
  const hours = shiftDurationHours(start_time, end_time);
  const resolved = getBreakRuleFromCompliance(compliance, hours);

  if (resolved.kind === "required") {
    return {
      kind: "required",
      minutes: resolved.minutes,
      minSegmentMinutes: resolved.minSegmentMinutes,
    };
  }
  if (resolved.kind === "max") {
    return {
      kind: "max",
      minutes: resolved.minutes,
      minSegmentMinutes: resolved.minSegmentMinutes,
    };
  }
  return { kind: "none", minutes: 0, minSegmentMinutes: resolved.minSegmentMinutes };
}

function breakIntervalOnShiftTimeline(
  break_start: string,
  break_end: string,
  startM: number,
  endM: number
): { start: number; end: number } | null {
  const MINUTES_PER_DAY = 24 * 60;
  let bs = timeToMinutes(break_start);
  let be = timeToMinutes(break_end);
  if (be <= bs) be += MINUTES_PER_DAY;

  for (const offset of [0, MINUTES_PER_DAY, -MINUTES_PER_DAY]) {
    const bStart = bs + offset;
    const bEnd = be + offset;
    if (bStart >= startM - 1 && bEnd <= endM + 1 && bEnd > bStart) {
      return { start: bStart, end: bEnd };
    }
  }
  return null;
}

function totalBreakMinutesOnTimeline(
  breaks: ShiftTypeBreakInput[],
  startM: number,
  endM: number
): number {
  let total = 0;
  for (const b of breaks) {
    const interval = breakIntervalOnShiftTimeline(b.break_start, b.break_end, startM, endM);
    if (!interval) continue;
    total += interval.end - interval.start;
  }
  return Math.round(total);
}

function breaksCenteredOnShift(
  breaks: ShiftTypeBreakInput[],
  startM: number,
  endM: number
): boolean {
  const midShift = (startM + endM) / 2;
  let weightedMid = 0;
  let total = 0;

  for (const b of breaks) {
    const interval = breakIntervalOnShiftTimeline(b.break_start, b.break_end, startM, endM);
    if (!interval) return false;
    const len = interval.end - interval.start;
    weightedMid += ((interval.start + interval.end) / 2) * len;
    total += len;
  }

  if (total <= 0) return true;
  return Math.abs(weightedMid / total - midShift) <= 2;
}

function validateBreakSegments(
  breaks: ShiftTypeBreakInput[],
  startM: number,
  endM: number,
  minSegmentMinutes?: number
): { ok: true } | { ok: false; error: string } {
  if (!minSegmentMinutes || minSegmentMinutes <= 0) return { ok: true };

  for (const b of breaks) {
    const interval = breakIntervalOnShiftTimeline(b.break_start, b.break_end, startM, endM);
    if (!interval) continue;
    const len = interval.end - interval.start;
    if (len > 0 && len < minSegmentMinutes) {
      return {
        ok: false,
        error: `Jede Pause muss mindestens ${minSegmentMinutes} Minuten dauern.`,
      };
    }
  }
  return { ok: true };
}

export function validateShiftTypeBreaksForCountry(
  countryCode: string | null | undefined,
  start_time: string,
  end_time: string,
  breaks: ShiftTypeBreakInput[]
): { ok: true } | { ok: false; error: string } {
  const durationMin = shiftDurationMinutes(start_time, end_time);
  if (durationMin <= 0) {
    return { ok: false, error: "Uhrzeit bis muss nach Uhrzeit von liegen." };
  }

  const { startM, endM } = shiftWindowMinutes(start_time, end_time);
  const rule = getBreakDurationRuleForCountry(countryCode, start_time, end_time);
  const totalBreak = totalBreakMinutesOnTimeline(breaks, startM, endM);

  for (const b of breaks) {
    if (!breakIntervalOnShiftTimeline(b.break_start, b.break_end, startM, endM)) {
      return {
        ok: false,
        error:
          "Alle Pausen müssen innerhalb der Schichtzeit liegen (nicht z. B. mittags bei Spätschicht).",
      };
    }
  }

  const segmentCheck = validateBreakSegments(breaks, startM, endM, rule.minSegmentMinutes);
  if (!segmentCheck.ok) return segmentCheck;

  if (rule.kind === "none") {
    return { ok: true };
  }

  if (rule.kind === "max") {
    if (totalBreak > rule.minutes) {
      return {
        ok: false,
        error: `Die Gesamtpause darf höchstens ${rule.minutes} Minuten betragen.`,
      };
    }
    if (breaks.length > 0 && !breaksCenteredOnShift(breaks, startM, endM)) {
      return {
        ok: false,
        error: "Pausen sollen mittig in der Schichtzeit liegen.",
      };
    }
    return { ok: true };
  }

  if (breaks.length === 0 || totalBreak !== rule.minutes) {
    return {
      ok: false,
      error: `Bei dieser Schichtdauer ist eine Gesamtpause von ${rule.minutes} Minuten erforderlich.`,
    };
  }

  if (!breaksCenteredOnShift(breaks, startM, endM)) {
    return {
      ok: false,
      error: "Die Pause muss mittig in der Schichtzeit liegen.",
    };
  }

  return { ok: true };
}

export function validateShiftDurationForCountry(input: {
  countryCode: string | null | undefined;
  start_time: string;
  end_time: string;
  weekday: number;
  point: ComplianceEnforcementPoint;
  /** ISO-Datum (YYYY-MM-DD) — für Feiertagsprüfung bei Schichtzuweisung */
  shiftDate?: string;
}): { ok: true; warnings: string[] } | { ok: false; error: string } {
  const compliance = resolveCompliance(input.countryCode);
  const hours = shiftDurationHours(input.start_time, input.end_time);
  const warnings: string[] = [];
  const jsDay = toJsWeekday(input.weekday);

  const maxRule = getRule(compliance, "max_shift_duration", "standard_workday_max_hours");
  if (maxRule && maxRule.enforceAt.includes(input.point)) {
    if (isWorkdayForRule(input.weekday, maxRule)) {
      const extended = getRule(compliance, "rolling_average_hours", "extended_workday_with_average");
      const hardMax = extended?.temporaryMaxHours ?? maxRule.maxHours;

      if (hours > hardMax) {
        return {
          ok: false,
          error: `Schichtdauer ${hours.toFixed(1).replace(".0", "")} h überschreitet das Maximum von ${hardMax} h (Werktag).`,
        };
      }

      if (hours > maxRule.maxHours) {
        if (extended && hours <= extended.temporaryMaxHours) {
          warnings.push(
            `Schicht über ${maxRule.maxHours} h — vorübergehend bis ${extended.temporaryMaxHours} h nur mit Einhaltung des ${extended.windowWeeks}-Wochen-Durchschnitts.`
          );
        } else {
          return {
            ok: false,
            error: `Reguläre Höchstarbeitszeit von ${maxRule.maxHours} h pro Werktag überschritten.`,
          };
        }
      }
    }
  }

  const restricted = getRule(compliance, "restricted_work_days", "sunday_holiday_work");
  if (
    restricted &&
    restricted.enforceAt.includes(input.point) &&
    restricted.restrictedWeekdays.includes(jsDay)
  ) {
    warnings.push(
      "Sonntagsarbeit ist grundsätzlich eingeschränkt — ggf. Ersatzruhetag erforderlich."
    );
  }

  if (
    restricted &&
    restricted.publicHolidaysRestricted &&
    restricted.enforceAt.includes(input.point) &&
    input.shiftDate &&
    isPublicHolidayForCountry(input.countryCode, input.shiftDate)
  ) {
    const holidayName = getPublicHolidayNameForCountry(
      input.countryCode,
      input.shiftDate,
      "de"
    );
    warnings.push(
      holidayName
        ? `Feiertagsarbeit (${holidayName}) — ggf. Ersatzruhetag erforderlich.`
        : "Feiertagsarbeit — ggf. Ersatzruhetag erforderlich."
    );
  }

  const nightRule = getRule(compliance, "night_work", "night_work");
  if (nightRule && nightRule.enforceAt.includes(input.point)) {
    if (shiftOverlapsNightWindow(input.start_time, input.end_time, nightRule.nightStartHour, nightRule.nightEndHour)) {
      warnings.push(
        `Nachtarbeit (${nightRule.nightStartHour}:00–${nightRule.nightEndHour}:00 Uhr) — Ausgleichstage oder Zuschläge prüfen.`
      );
    }
  }

  return { ok: true, warnings };
}

function shiftOverlapsNightWindow(
  start_time: string,
  end_time: string,
  nightStartHour: number,
  nightEndHour: number
): boolean {
  const { startM, endM } = shiftWindowMinutes(start_time, end_time);
  const nightStart = nightStartHour * 60;
  const nightEnd = nightEndHour * 60;
  const MINUTES_PER_DAY = 24 * 60;

  for (let dayOffset = -MINUTES_PER_DAY; dayOffset <= MINUTES_PER_DAY; dayOffset += MINUTES_PER_DAY) {
    const nStart = nightStart + dayOffset;
    const nEnd = nightEnd + dayOffset + (nightEndHour <= nightStartHour ? MINUTES_PER_DAY : 0);
    if (startM < nEnd && endM > nStart) return true;
  }
  return false;
}

export function availabilityDurationHours(start_time: string, end_time: string): number {
  const startM = timeToMinutes(start_time);
  let endM = timeToMinutes(end_time);
  const MINUTES_PER_DAY = 24 * 60;
  if (endM <= startM) endM += MINUTES_PER_DAY;
  return (endM - startM) / 60;
}

/** Verfügbarkeit = Zeitfenster, in dem Personal grundsätzlich einplanbar ist — keine Schichtdauer-Compliance. */
export function validateAvailabilityForCountry(_input: {
  countryCode: string | null | undefined;
  weekday: number;
  start_time: string;
  end_time: string;
}): { ok: true; warnings: string[] } {
  return { ok: true, warnings: [] };
}

function calendarDateInTimeZone(
  isoTimestamp: string,
  timeZone: string = DEFAULT_ORGANIZATION_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoTimestamp));
}

export function validateRestPeriodForCountry(input: {
  countryCode: string | null | undefined;
  newStartsAt: string;
  newEndsAt: string;
  /** Planungstag der neuen Schicht — Pausen zwischen Einsatzzeiten am selben Tag sind keine Ruhezeit. */
  newShiftDate?: string;
  /** Organisations-Zeitzone für Kalendertags-Grenzen (Ruhezeit nur zwischen Tagen). */
  timeZone?: string;
  existingShifts: readonly {
    id?: string;
    starts_at: string;
    ends_at: string;
    shift_date?: string;
  }[];
  excludeShiftId?: string;
}): { ok: true } | { ok: false; error: string } {
  const compliance = resolveCompliance(input.countryCode);
  const rule = getRule(compliance, "min_rest_period", "min_rest_between_shifts");
  if (!rule) return { ok: true };

  const timeZone = input.timeZone ?? DEFAULT_ORGANIZATION_TIME_ZONE;
  const newStart = new Date(input.newStartsAt).getTime();
  const newEnd = new Date(input.newEndsAt).getTime();
  const newStartDate = calendarDateInTimeZone(input.newStartsAt, timeZone);
  const newEndDate = calendarDateInTimeZone(input.newEndsAt, timeZone);

  for (const shift of input.existingShifts) {
    if (input.excludeShiftId && shift.id === input.excludeShiftId) continue;

    if (
      input.newShiftDate &&
      shift.shift_date &&
      shift.shift_date.slice(0, 10) === input.newShiftDate.slice(0, 10)
    ) {
      continue;
    }

    const existingStart = new Date(shift.starts_at).getTime();
    const existingEnd = new Date(shift.ends_at).getTime();
    const existingStartDate = calendarDateInTimeZone(shift.starts_at, timeZone);
    const existingEndDate = calendarDateInTimeZone(shift.ends_at, timeZone);

    if (existingEnd <= newStart) {
      if (existingEndDate === newStartDate) {
        continue;
      }
      const restHours = (newStart - existingEnd) / (1000 * 60 * 60);
      if (restHours < rule.minHours) {
        return {
          ok: false,
          error: `Mindestruhezeit von ${rule.minHours} Stunden zwischen Schichten nicht eingehalten.`,
        };
      }
    }

    if (existingStart >= newEnd) {
      if (existingStartDate === newEndDate) {
        continue;
      }
      const restHours = (existingStart - newEnd) / (1000 * 60 * 60);
      if (restHours < rule.minHours) {
        return {
          ok: false,
          error: `Mindestruhezeit von ${rule.minHours} Stunden zwischen Schichten nicht eingehalten.`,
        };
      }
    }
  }

  return { ok: true };
}

export function validateStaffingWeekdayForCountry(input: {
  countryCode: string | null | undefined;
  weekday: number;
}): { ok: true; warnings: string[] } | { ok: false; error: string } {
  const compliance = resolveCompliance(input.countryCode);
  const restricted = getRule(compliance, "restricted_work_days", "sunday_holiday_work");
  const jsDay = toJsWeekday(input.weekday);
  if (
    !restricted ||
    !restricted.enforceAt.includes("staffing") ||
    !restricted.restrictedWeekdays.includes(jsDay)
  ) {
    return { ok: true, warnings: [] };
  }

  return {
    ok: true,
    warnings: [
      "Personalbedarf an Sonntagen — Sonntagsarbeit erfordert ggf. Ersatzruhetag.",
    ],
  };
}
