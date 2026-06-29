import {
  shiftNetWorkHours,
} from "./shift-type-break-rules";
import type { ShiftTypeBreakInput } from "./interface";
import {
  getRule,
  type ComplianceEnforcementPoint,
} from "@schichtwerk/compliance";
import {
  resolveCompliance,
  validateShiftDurationForCountry,
} from "./labor-compliance-validation";
import { timeToMinutes } from "./profile-availability-validation";

export type DayShiftTimeWindow = {
  startTime: string;
  endTime: string;
  breaks?: readonly ShiftTypeBreakInput[];
};

export type EmployeeDayShiftComplianceViolation = {
  kind: "shift_duration" | "daily_hours" | "rest_period";
  totalHours?: number;
  limitHours?: number;
  shiftStartTime?: string;
  shiftEndTime?: string;
  shiftDurationHours?: number;
  minRestHours?: number;
  actualRestHours?: number;
  earlierWindow?: DayShiftTimeWindow;
  laterWindow?: DayShiftTimeWindow;
  error: string;
};

function shiftWorkHours(startTime: string, endTime: string, breaks?: readonly ShiftTypeBreakInput[]): number {
  return shiftNetWorkHours(startTime, endTime, breaks);
}

function formatHours(hours: number): string {
  return hours.toFixed(1).replace(".0", "");
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

export function sumDayShiftWorkHours(
  windows: readonly DayShiftTimeWindow[]
): number {
  return windows.reduce(
    (sum, window) =>
      sum + shiftWorkHours(window.startTime, window.endTime, window.breaks),
    0
  );
}

function dedupeWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)];
}

/** Prüft Einzel-Schichten und Tages-Gesamtdauer. Ruhezeit (11 h) nur zwischen Tagen, nicht zwischen Einsatzzeiten am selben Tag. */
export function validateEmployeeDayShiftAssignments(input: {
  countryCode: string | null | undefined;
  shiftDate: string;
  weekday: number;
  windows: readonly DayShiftTimeWindow[];
  point?: ComplianceEnforcementPoint;
}):
  | { ok: true; warnings: string[] }
  | ({ ok: false } & EmployeeDayShiftComplianceViolation) {
  const point = input.point ?? "shift_assign";
  const warnings: string[] = [];

  if (input.windows.length === 0) {
    return { ok: true, warnings: [] };
  }

  const compliance = resolveCompliance(input.countryCode);

  for (const window of input.windows) {
    const durationCheck = validateShiftDurationForCountry({
      countryCode: input.countryCode,
      start_time: window.startTime,
      end_time: window.endTime,
      weekday: input.weekday,
      shiftDate: input.shiftDate,
      point,
      breaks: window.breaks,
    });
    if (!durationCheck.ok) {
      const hours = shiftWorkHours(window.startTime, window.endTime, window.breaks);
      const maxRule = getRule(compliance, "max_shift_duration", "standard_workday_max_hours");
      const extended = getRule(
        compliance,
        "rolling_average_hours",
        "extended_workday_with_average"
      );
      const limitHours = extended?.temporaryMaxHours ?? maxRule?.maxHours ?? hours;
      return {
        ok: false,
        kind: "shift_duration",
        shiftStartTime: window.startTime,
        shiftEndTime: window.endTime,
        shiftDurationHours: hours,
        limitHours,
        error: durationCheck.error,
      };
    }
    warnings.push(...durationCheck.warnings);
  }

  if (input.windows.length === 1) {
    return { ok: true, warnings: dedupeWarnings(warnings) };
  }

  const totalHours = sumDayShiftWorkHours(input.windows);
  const maxRule = getRule(compliance, "max_shift_duration", "standard_workday_max_hours");
  const extended = getRule(
    compliance,
    "rolling_average_hours",
    "extended_workday_with_average"
  );

  if (maxRule?.enforceAt.includes(point) && isWorkdayForRule(input.weekday, maxRule)) {
    const hardMax = extended?.temporaryMaxHours ?? maxRule.maxHours;
    if (totalHours > hardMax) {
      warnings.push(
        `Gesamtarbeitszeit ${formatHours(totalHours)} h über ${hardMax} h — mehrere Einsatzzeiten am selben Tag mit Pause; rechtliche Gesamtgrenze prüfen.`
      );
    } else if (totalHours > maxRule.maxHours) {
      if (extended && totalHours <= extended.temporaryMaxHours) {
        warnings.push(
          `Gesamtarbeitszeit ${formatHours(totalHours)} h über ${maxRule.maxHours} h — vorübergehend bis ${extended.temporaryMaxHours} h nur mit Einhaltung des ${extended.windowWeeks}-Wochen-Durchschnitts.`
        );
      } else {
        warnings.push(
          `Gesamtarbeitszeit ${formatHours(totalHours)} h über reguläre ${maxRule.maxHours} h — mehrere Einsatzzeiten am selben Tag mit Pause.`
        );
      }
    }
  }

  return { ok: true, warnings: dedupeWarnings(warnings) };
}
