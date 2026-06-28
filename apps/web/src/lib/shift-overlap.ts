import { buildShiftTimestamps, DEFAULT_ORGANIZATION_TIME_ZONE } from "@/lib/dates";

/** Schicht-Intervalle [start, end): Randberührung = kein Overlap. */

export function shiftsOverlapIso(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a0 = new Date(startA).getTime();
  const a1 = new Date(endA).getTime();
  const b0 = new Date(startB).getTime();
  const b1 = new Date(endB).getTime();
  return a0 < b1 && b0 < a1;
}

export function areaCalendarShiftWindowsOverlap(
  shiftDate: string,
  startA: string,
  endA: string,
  startB: string,
  endB: string,
  timeZone: string = DEFAULT_ORGANIZATION_TIME_ZONE
): boolean {
  const a = buildShiftTimestamps(shiftDate, startA, endA, timeZone);
  const b = buildShiftTimestamps(shiftDate, startB, endB, timeZone);
  return shiftsOverlapIso(a.starts_at, a.ends_at, b.starts_at, b.ends_at);
}

export type AreaCalendarAssignmentTimeWindow = {
  employeeId: string;
  startTime: string;
  endTime: string;
};

export type ShiftRefForAssignmentWindow = {
  id?: string;
  employee_id?: string;
  employeeId?: string;
  shift_date: string;
  startTime: string;
  endTime: string;
  location_area_id?: string | null;
  locationAreaId?: string | null;
};

function shiftTimesCompleteForOverlap(startTime: string, endTime: string): boolean {
  const start = startTime.slice(0, 5);
  const end = endTime.slice(0, 5);
  return /^\d{1,2}:\d{2}$/.test(start) && /^\d{1,2}:\d{2}$/.test(end);
}

function resolveShiftRefEmployeeId(
  shift: ShiftRefForAssignmentWindow
): string | null {
  return shift.employee_id ?? shift.employeeId ?? null;
}

/** Organisationsweite Schichten eines Tages als Zuweisungsfenster (Overlap-Prüfung). */
export function assignmentWindowsFromShiftRefsForDate(
  shifts: readonly ShiftRefForAssignmentWindow[],
  shiftDate: string,
  options?: {
    excludeShiftIds?: ReadonlySet<string>;
  }
): AreaCalendarAssignmentTimeWindow[] {
  const windows: AreaCalendarAssignmentTimeWindow[] = [];

  for (const shift of shifts) {
    if (shift.shift_date !== shiftDate) continue;
    if (shift.id && options?.excludeShiftIds?.has(shift.id)) continue;

    const employeeId = resolveShiftRefEmployeeId(shift);
    if (!employeeId) continue;
    if (!shiftTimesCompleteForOverlap(shift.startTime, shift.endTime)) continue;

    windows.push({
      employeeId,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
  }

  return windows;
}

export function locationDayAssignmentsFromShiftRefsForDate(
  shifts: readonly ShiftRefForAssignmentWindow[],
  shiftDate: string,
  options?: {
    excludeShiftIds?: ReadonlySet<string>;
  }
): {
  employeeId: string;
  startTime: string;
  endTime: string;
  locationAreaId: string | null;
}[] {
  const assignments: {
    employeeId: string;
    startTime: string;
    endTime: string;
    locationAreaId: string | null;
  }[] = [];

  for (const shift of shifts) {
    if (shift.shift_date !== shiftDate) continue;
    if (shift.id && options?.excludeShiftIds?.has(shift.id)) continue;

    const employeeId = resolveShiftRefEmployeeId(shift);
    if (!employeeId) continue;
    if (!shiftTimesCompleteForOverlap(shift.startTime, shift.endTime)) continue;

    assignments.push({
      employeeId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      locationAreaId: shift.location_area_id ?? shift.locationAreaId ?? null,
    });
  }

  return assignments;
}

export function employeeHasOverlappingAreaCalendarAssignment(
  employeeId: string,
  shiftDate: string,
  windowStart: string,
  windowEnd: string,
  assignments: readonly AreaCalendarAssignmentTimeWindow[]
): boolean {
  return assignments.some(
    (assignment) =>
      assignment.employeeId === employeeId &&
      areaCalendarShiftWindowsOverlap(
        shiftDate,
        windowStart,
        windowEnd,
        assignment.startTime,
        assignment.endTime
      )
  );
}

export function findEmployeeWithOverlappingAreaCalendarAssignments(
  shiftDate: string,
  candidateRows: readonly AreaCalendarAssignmentTimeWindow[],
  existingAssignments: readonly AreaCalendarAssignmentTimeWindow[],
  employeeNameById: ReadonlyMap<string, string>,
  timeZone: string = DEFAULT_ORGANIZATION_TIME_ZONE
): string | null {
  for (let i = 0; i < candidateRows.length; i++) {
    const row = candidateRows[i];

    for (const existing of existingAssignments) {
      if (existing.employeeId !== row.employeeId) continue;
      if (
        areaCalendarShiftWindowsOverlap(
          shiftDate,
          row.startTime,
          row.endTime,
          existing.startTime,
          existing.endTime,
          timeZone
        )
      ) {
        return employeeNameById.get(row.employeeId) ?? row.employeeId;
      }
    }

    for (let j = i + 1; j < candidateRows.length; j++) {
      const other = candidateRows[j];
      if (other.employeeId !== row.employeeId) continue;
      if (
        areaCalendarShiftWindowsOverlap(
          shiftDate,
          row.startTime,
          row.endTime,
          other.startTime,
          other.endTime,
          timeZone
        )
      ) {
        return employeeNameById.get(row.employeeId) ?? row.employeeId;
      }
    }
  }

  return null;
}
