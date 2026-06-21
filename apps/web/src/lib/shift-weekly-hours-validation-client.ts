import {
  isoWeekStartFromShiftDate,
  resolveProfileWeeklyHoursTarget,
  validateEmployeeWeeklyHoursAfterAssign,
  type WeeklyShiftHourWindow,
} from "@schichtwerk/database";
import {
  areAreaCalendarShiftTimesComplete,
  resolveShiftAssignmentRequestWindow,
  type ShiftAssignmentRequestWindow,
} from "@/lib/available-employees-for-shift";
import { buildShiftTimestamps } from "@/lib/dates";
import { areaCalendarShiftWindowsOverlap } from "@/lib/shift-overlap";

export type ShiftAssignWeekShiftRef = {
  id: string;
  employee_id: string;
  shift_date: string;
  startTime: string;
  endTime: string;
};

type ClientWeekShift = ShiftAssignWeekShiftRef;

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

export function employeeEligibleForShiftWeeklyHours(input: {
  employeeId: string;
  weeklyHours: number | null;
  weekShifts: readonly ShiftAssignWeekShiftRef[];
  shiftDate: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  excludeShiftIds?: ReadonlySet<string>;
  additionalWeekWindows?: readonly WeeklyShiftHourWindow[];
}): boolean {
  return validateShiftAssignWeeklyHoursClient(input).ok;
}

export function filterEmployeesWithinWeeklyHoursForShift<
  T extends { id: string; weekly_hours?: number | null },
>(
  employees: readonly T[],
  options: {
    weekShifts: readonly ShiftAssignWeekShiftRef[];
    shiftDate: string;
    startTime: string;
    endTime: string;
    timeZone: string;
    assignContextForEmployee?: (
      employeeId: string
    ) => {
      excludeShiftIds?: ReadonlySet<string>;
      additionalWeekWindows?: readonly WeeklyShiftHourWindow[];
    };
    excludeShiftIds?: ReadonlySet<string>;
    additionalWeekWindows?: readonly WeeklyShiftHourWindow[];
  }
): T[] {
  if (!areAreaCalendarShiftTimesComplete(options.startTime, options.endTime)) {
    return [...employees];
  }

  return employees.filter((employee) => {
    const assignContext = options.assignContextForEmployee?.(employee.id);
    return employeeEligibleForShiftWeeklyHours({
      employeeId: employee.id,
      weeklyHours: employee.weekly_hours ?? null,
      weekShifts: options.weekShifts,
      shiftDate: options.shiftDate,
      startTime: options.startTime,
      endTime: options.endTime,
      timeZone: options.timeZone,
      excludeShiftIds:
        assignContext?.excludeShiftIds ?? options.excludeShiftIds,
      additionalWeekWindows:
        assignContext?.additionalWeekWindows ?? options.additionalWeekWindows,
    });
  });
}

type BulkRowWeeklyHoursRef = ShiftAssignmentRequestWindow & {
  id: string;
  existingShiftId?: string;
  employeeId: string;
};

export function weeklyHoursAssignContextForBulkShiftRow(input: {
  row: BulkRowWeeklyHoursRef;
  allRows: readonly BulkRowWeeklyHoursRef[];
  shiftDate: string;
  emptyEmployeeId: string;
}): (employeeId: string) => {
  excludeShiftIds?: ReadonlySet<string>;
  additionalWeekWindows: WeeklyShiftHourWindow[];
} {
  return (employeeId: string) => {
    const excludeShiftIds = new Set<string>();
    if (input.row.existingShiftId) {
      excludeShiftIds.add(input.row.existingShiftId);
    }

    const additionalWeekWindows: WeeklyShiftHourWindow[] = [];
    for (const other of input.allRows) {
      if (other.id === input.row.id) continue;
      if (other.employeeId !== employeeId) continue;
      if (other.employeeId === input.emptyEmployeeId) continue;

      const requestWindow = resolveShiftAssignmentRequestWindow(other);
      if (
        !areAreaCalendarShiftTimesComplete(
          requestWindow.startTime,
          requestWindow.endTime
        )
      ) {
        continue;
      }

      if (other.existingShiftId) {
        excludeShiftIds.add(other.existingShiftId);
      }

      additionalWeekWindows.push({
        shiftDate: input.shiftDate,
        startTime: requestWindow.startTime,
        endTime: requestWindow.endTime,
      });
    }

    return {
      excludeShiftIds: excludeShiftIds.size > 0 ? excludeShiftIds : undefined,
      additionalWeekWindows,
    };
  };
}
