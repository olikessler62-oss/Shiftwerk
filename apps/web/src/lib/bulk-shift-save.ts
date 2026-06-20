import { areAreaCalendarShiftTimesComplete } from "@/lib/available-employees-for-shift";

export type BulkShiftSaveRow = {
  id: string;
  existingShiftId?: string;
  employeeId: string;
  qualificationId: string;
  startTime: string;
  endTime: string;
};

export function isCompleteBulkShiftRow(
  row: BulkShiftSaveRow,
  options?: { withoutServiceHours?: boolean }
): boolean {
  if (
    !row.employeeId ||
    !areAreaCalendarShiftTimesComplete(row.startTime, row.endTime)
  ) {
    return false;
  }
  if (!options?.withoutServiceHours && !row.qualificationId.length) {
    return false;
  }
  return true;
}

export function isSaveableNewBulkShiftRow(
  row: BulkShiftSaveRow,
  options?: { withoutServiceHours?: boolean }
): boolean {
  return !row.existingShiftId && isCompleteBulkShiftRow(row, options);
}

export function listCompleteBulkShiftRowsForAssign(
  rows: readonly BulkShiftSaveRow[],
  withoutServiceHours = false
): BulkShiftSaveRow[] {
  return rows.filter((row) =>
    isCompleteBulkShiftRow(row, { withoutServiceHours })
  );
}

export function listUnsavedBulkShiftRows(
  rows: readonly BulkShiftSaveRow[]
): BulkShiftSaveRow[] {
  return rows.filter((row) => !row.existingShiftId);
}

export function listSaveableNewBulkShiftRows(
  rows: readonly BulkShiftSaveRow[],
  options?: { withoutServiceHours?: boolean }
): BulkShiftSaveRow[] {
  return rows.filter((row) => isSaveableNewBulkShiftRow(row, options));
}

export type BulkShiftSaveIntent =
  | { kind: "persist"; saveableRows: BulkShiftSaveRow[] }
  | { kind: "reject-unsaved-incomplete" }
  | { kind: "close-without-changes" };

export function resolveBulkShiftSaveIntent(
  rows: readonly BulkShiftSaveRow[],
  hasDeletes: boolean,
  options?: { withoutServiceHours?: boolean }
): BulkShiftSaveIntent {
  const unsavedRows = listUnsavedBulkShiftRows(rows);
  const saveableRows = listSaveableNewBulkShiftRows(rows, options);

  if (saveableRows.length > 0 || hasDeletes) {
    return { kind: "persist", saveableRows };
  }

  if (unsavedRows.length > 0) {
    return { kind: "reject-unsaved-incomplete" };
  }

  return { kind: "close-without-changes" };
}
