import { isoWeekEndFromWeekStart } from "./shift-confirmation-send";
import { shiftNetWorkHours, roundWorkHours } from "./shift-type-break-rules";
import type { ShiftTypeBreakInput } from "./interface";
import { startOfWeekMonday, toISODateLocal } from "./shift-retention";

export const DEFAULT_PROFILE_WEEKLY_HOURS = 40;

export type WeeklyShiftHourWindow = {
  shiftDate: string;
  startTime: string;
  endTime: string;
  breaks?: readonly ShiftTypeBreakInput[];
};

export type WeeklyHoursExistingShift = {
  id: string;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  startTime?: string;
  endTime?: string;
  breaks?: readonly ShiftTypeBreakInput[];
};

export function isoWeekStartFromShiftDate(shiftDate: string): string {
  const [y, m, d] = shiftDate.split("-").map(Number);
  return toISODateLocal(startOfWeekMonday(new Date(y, m - 1, d)));
}

export function isShiftDateInIsoWeek(shiftDate: string, weekStart: string): boolean {
  const weekEnd = isoWeekEndFromWeekStart(weekStart);
  return shiftDate >= weekStart && shiftDate <= weekEnd;
}

export function resolveProfileWeeklyHoursTarget(
  weeklyHours: number | null | undefined
): number {
  return weeklyHours ?? DEFAULT_PROFILE_WEEKLY_HOURS;
}

export function shiftHoursFromIsoRange(startsAt: string, endsAt: string): number {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.round((ms / 3_600_000) * 10) / 10;
}

function shiftWorkHoursForWeeklyTotal(shift: WeeklyHoursExistingShift): number {
  if (shift.startTime && shift.endTime) {
    return shiftNetWorkHours(shift.startTime, shift.endTime, shift.breaks);
  }
  return shiftHoursFromIsoRange(shift.starts_at, shift.ends_at);
}

function roundHours(hours: number): number {
  return roundWorkHours(hours);
}

export function sumEmployeeWeekHours(input: {
  weekStart: string;
  existingShifts: readonly WeeklyHoursExistingShift[];
  excludeShiftIds?: ReadonlySet<string>;
  additionalWindows?: readonly WeeklyShiftHourWindow[];
}): number {
  const excludeIds = input.excludeShiftIds ?? new Set<string>();
  let total = 0;

  for (const shift of input.existingShifts) {
    if (excludeIds.has(shift.id)) continue;
    if (!isShiftDateInIsoWeek(shift.shift_date, input.weekStart)) continue;
    total += shiftWorkHoursForWeeklyTotal(shift);
  }

  for (const window of input.additionalWindows ?? []) {
    if (!isShiftDateInIsoWeek(window.shiftDate, input.weekStart)) continue;
    total += shiftNetWorkHours(window.startTime, window.endTime, window.breaks);
  }

  return roundHours(total);
}

export function formatWeeklyHoursExceededError(input: {
  weekTotal: number;
  targetHours: number;
  employeeName?: string;
}): string {
  const total = roundHours(input.weekTotal);
  const target = roundHours(input.targetHours);
  const core = `Wochenstunden überschritten — nach Zuweisung ${total} Std. (Maximum ${target} Std.).`;
  const name = input.employeeName?.trim();
  return name ? `${name}: ${core}` : core;
}

export function validateEmployeeWeeklyHoursAfterAssign(input: {
  targetHours: number;
  weekStart: string;
  existingShifts: readonly WeeklyHoursExistingShift[];
  excludeShiftIds?: ReadonlySet<string>;
  proposedWindows: readonly WeeklyShiftHourWindow[];
  employeeName?: string;
}): { ok: true; weekTotal: number } | { ok: false; error: string } {
  const weekTotal = sumEmployeeWeekHours({
    weekStart: input.weekStart,
    existingShifts: input.existingShifts,
    excludeShiftIds: input.excludeShiftIds,
    additionalWindows: input.proposedWindows,
  });

  if (weekTotal <= input.targetHours) {
    return { ok: true, weekTotal };
  }

  return {
    ok: false,
    error: formatWeeklyHoursExceededError({
      weekTotal,
      targetHours: input.targetHours,
      employeeName: input.employeeName,
    }),
  };
}
