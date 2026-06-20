import {
  isoWeekStartFromShiftDate,
  resolveProfileWeeklyHoursTarget,
} from "./employee-weekly-hours-validation";

export type ShiftForWeeklyHoursConflict = {
  id: string;
  employeeId: string;
  shift_date: string;
  durationHours: number;
  confirmation_status?: string | null;
};

export type ShiftWeeklyHoursConflict = {
  shiftId: string;
  employeeId: string;
  shiftDate: string;
  weekStart: string;
  weekTotalHours: number;
  targetHours: number;
  confirmationStatus: string | null;
};

function roundHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

export function collectEmployeeWeeklyHoursConflicts(input: {
  employeeId: string;
  targetHours: number;
  fromDateISO: string;
  shifts: readonly ShiftForWeeklyHoursConflict[];
  visibleShiftIds?: ReadonlySet<string>;
  includeProposed?: boolean;
}): ShiftWeeklyHoursConflict[] {
  const byWeek = new Map<string, ShiftForWeeklyHoursConflict[]>();

  for (const shift of input.shifts) {
    if (shift.employeeId !== input.employeeId) continue;
    const weekStart = isoWeekStartFromShiftDate(shift.shift_date);
    const list = byWeek.get(weekStart) ?? [];
    list.push(shift);
    byWeek.set(weekStart, list);
  }

  const conflicts: ShiftWeeklyHoursConflict[] = [];

  for (const [weekStart, weekShifts] of byWeek) {
    const hasFutureOrToday = weekShifts.some(
      (shift) => shift.shift_date >= input.fromDateISO
    );
    if (!hasFutureOrToday) continue;

    const weekTotalHours = roundHours(
      weekShifts.reduce((sum, shift) => sum + shift.durationHours, 0)
    );
    if (weekTotalHours <= input.targetHours) continue;

    for (const shift of weekShifts) {
      if (shift.shift_date < input.fromDateISO) continue;
      if (input.visibleShiftIds && !input.visibleShiftIds.has(shift.id)) {
        continue;
      }

      const status = shift.confirmation_status ?? "proposed";
      if (!input.includeProposed && status === "proposed") continue;

      conflicts.push({
        shiftId: shift.id,
        employeeId: shift.employeeId,
        shiftDate: shift.shift_date,
        weekStart,
        weekTotalHours,
        targetHours: input.targetHours,
        confirmationStatus: shift.confirmation_status ?? null,
      });
    }
  }

  conflicts.sort((a, b) => {
    const dateDiff = a.shiftDate.localeCompare(b.shiftDate);
    if (dateDiff !== 0) return dateDiff;
    return a.shiftId.localeCompare(b.shiftId);
  });

  return conflicts;
}

export function collectWeeklyHoursConflictsForEmployees(input: {
  fromDateISO: string;
  shifts: readonly ShiftForWeeklyHoursConflict[];
  weeklyHoursByEmployeeId: ReadonlyMap<string, number | null | undefined>;
  visibleShiftIds?: ReadonlySet<string>;
  includeProposed?: boolean;
}): ShiftWeeklyHoursConflict[] {
  const employeeIds = new Set(input.shifts.map((shift) => shift.employeeId));
  const conflicts: ShiftWeeklyHoursConflict[] = [];

  for (const employeeId of employeeIds) {
    const targetHours = resolveProfileWeeklyHoursTarget(
      input.weeklyHoursByEmployeeId.get(employeeId)
    );
    conflicts.push(
      ...collectEmployeeWeeklyHoursConflicts({
        employeeId,
        targetHours,
        fromDateISO: input.fromDateISO,
        shifts: input.shifts,
        visibleShiftIds: input.visibleShiftIds,
        includeProposed: input.includeProposed,
      })
    );
  }

  conflicts.sort((a, b) => {
    const dateDiff = a.shiftDate.localeCompare(b.shiftDate);
    if (dateDiff !== 0) return dateDiff;
    return a.shiftId.localeCompare(b.shiftId);
  });

  return conflicts;
}

export function shiftForWeeklyHoursConflictFromEmployeeShift(input: {
  id: string;
  employee_id: string;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  confirmation_status?: string | null;
  durationHours: number;
}): ShiftForWeeklyHoursConflict {
  return {
    id: input.id,
    employeeId: input.employee_id,
    shift_date: input.shift_date,
    durationHours: input.durationHours,
    confirmation_status: input.confirmation_status ?? null,
  };
}
