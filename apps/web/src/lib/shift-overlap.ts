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
