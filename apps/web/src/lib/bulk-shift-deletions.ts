import type { AreaCalendarAssignmentTimeWindow } from "@/lib/shift-overlap";
import type { LocationDayAssignment } from "@/lib/bulk-shift-day-compliance";

type ExistingAreaShiftRef = {
  id: string;
  employeeId: string;
  startTime: string;
  endTime: string;
};

type BulkRowExistingRef = {
  existingShiftId?: string;
};

function assignmentWindowKey(
  employeeId: string,
  startTime: string,
  endTime: string
): string {
  return `${employeeId}|${startTime.slice(0, 5)}|${endTime.slice(0, 5)}`;
}

export function resolveBulkShiftDeletedIds(
  existingAreaShifts: readonly ExistingAreaShiftRef[],
  rows: readonly BulkRowExistingRef[]
): string[] {
  const remainingIds = new Set(
    rows.flatMap((row) => (row.existingShiftId ? [row.existingShiftId] : []))
  );
  return existingAreaShifts
    .filter((shift) => !remainingIds.has(shift.id))
    .map((shift) => shift.id);
}

export function resolveRemainingAreaAssignments(
  existingAreaShifts: readonly ExistingAreaShiftRef[],
  rows: readonly BulkRowExistingRef[]
): AreaCalendarAssignmentTimeWindow[] {
  const remainingIds = new Set(
    rows.flatMap((row) => (row.existingShiftId ? [row.existingShiftId] : []))
  );
  return existingAreaShifts
    .filter((shift) => remainingIds.has(shift.id))
    .map(({ employeeId, startTime, endTime }) => ({
      employeeId,
      startTime,
      endTime,
    }));
}

export function filterLocationDayAssignmentsForBulkModal(
  locationDayAssignments: readonly LocationDayAssignment[],
  existingAreaShifts: readonly ExistingAreaShiftRef[],
  rows: readonly BulkRowExistingRef[],
  areaId: string
): LocationDayAssignment[] {
  const deletedIds = new Set(resolveBulkShiftDeletedIds(existingAreaShifts, rows));
  const deletedKeys = new Set(
    existingAreaShifts
      .filter((shift) => deletedIds.has(shift.id))
      .map((shift) =>
        assignmentWindowKey(shift.employeeId, shift.startTime, shift.endTime)
      )
  );

  return locationDayAssignments.filter((assignment) => {
    if (assignment.locationAreaId !== areaId) return true;
    const key = assignmentWindowKey(
      assignment.employeeId,
      assignment.startTime,
      assignment.endTime
    );
    return !deletedKeys.has(key);
  });
}
