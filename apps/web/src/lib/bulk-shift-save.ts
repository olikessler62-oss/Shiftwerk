import { areDashboardShiftTimesComplete } from "@/lib/available-employees-for-shift";

export type BulkShiftSaveRow = {
  id: string;
  existingShiftId?: string;
  employeeId: string;
  qualificationId: string;
  startTime: string;
  endTime: string;
};

export function isSaveableNewBulkShiftRow(row: BulkShiftSaveRow): boolean {
  return (
    !row.existingShiftId &&
    Boolean(row.employeeId) &&
    row.qualificationId.length > 0 &&
    areDashboardShiftTimesComplete(row.startTime, row.endTime)
  );
}

export function listUnsavedBulkShiftRows(
  rows: readonly BulkShiftSaveRow[]
): BulkShiftSaveRow[] {
  return rows.filter((row) => !row.existingShiftId);
}

export function listSaveableNewBulkShiftRows(
  rows: readonly BulkShiftSaveRow[]
): BulkShiftSaveRow[] {
  return rows.filter(isSaveableNewBulkShiftRow);
}

export type BulkShiftSaveIntent =
  | { kind: "persist"; saveableRows: BulkShiftSaveRow[] }
  | { kind: "reject-unsaved-incomplete" }
  | { kind: "close-without-changes" };

export function resolveBulkShiftSaveIntent(
  rows: readonly BulkShiftSaveRow[],
  hasDeletes: boolean
): BulkShiftSaveIntent {
  const unsavedRows = listUnsavedBulkShiftRows(rows);
  const saveableRows = listSaveableNewBulkShiftRows(rows);

  if (saveableRows.length > 0 || hasDeletes) {
    return { kind: "persist", saveableRows };
  }

  if (unsavedRows.length > 0) {
    return { kind: "reject-unsaved-incomplete" };
  }

  return { kind: "close-without-changes" };
}
