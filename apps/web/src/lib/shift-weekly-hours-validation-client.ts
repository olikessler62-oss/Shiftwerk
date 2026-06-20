import {
  isoWeekStartFromShiftDate,
  resolveProfileWeeklyHoursTarget,
  validateEmployeeWeeklyHoursAfterAssign,
  type WeeklyShiftHourWindow,
} from "@schichtwerk/database";
import { buildShiftTimestamps } from "@/lib/dates";
import { areaCalendarShiftWindowsOverlap } from "@/lib/shift-overlap";

type ClientWeekShift = {
  id: string;
  employee_id: string;
  shift_date: string;
  startTime: string;
  endTime: string;
};

export function validateShiftAssignWeeklyHoursClient(input: {
  employeeId: string;
  employeeName?: string;
  weeklyHours: number | null;
  weekShifts: readonly ClientWeekShift[];
  shiftDate: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  excludeShiftIds?: ReadonlySet<string>;
  additionalWeekWindows?: readonly WeeklyShiftHourWindow[];
}): { ok: true } | { ok: false; error: string } {
  const weekStart = isoWeekStartFromShiftDate(input.shiftDate);
  const targetHours = resolveProfileWeeklyHoursTarget(input.weeklyHours);
  const excludeIds = new Set(input.excludeShiftIds ?? []);

  for (const shift of input.weekShifts) {
    if (shift.employee_id !== input.employeeId) continue;
    if (shift.shift_date !== input.shiftDate) continue;
    if (excludeIds.has(shift.id)) continue;
    if (
      areaCalendarShiftWindowsOverlap(
        input.shiftDate,
        input.startTime,
        input.endTime,
        shift.startTime,
        shift.endTime,
        input.timeZone
      )
    ) {
      excludeIds.add(shift.id);
    }
  }

  const existingShifts = input.weekShifts
    .filter((shift) => shift.employee_id === input.employeeId)
    .map((shift) => {
      const timestamps = buildShiftTimestamps(
        shift.shift_date,
        shift.startTime,
        shift.endTime,
        input.timeZone
      );
      return {
        id: shift.id,
        shift_date: shift.shift_date,
        starts_at: timestamps.starts_at,
        ends_at: timestamps.ends_at,
      };
    });

  return validateEmployeeWeeklyHoursAfterAssign({
    targetHours,
    weekStart,
    existingShifts,
    excludeShiftIds: excludeIds,
    proposedWindows: [
      {
        shiftDate: input.shiftDate,
        startTime: input.startTime,
        endTime: input.endTime,
      },
      ...(input.additionalWeekWindows ?? []),
    ],
    employeeName: input.employeeName,
  });
}
