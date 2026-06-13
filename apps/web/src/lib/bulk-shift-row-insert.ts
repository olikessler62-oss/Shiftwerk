export type BulkShiftRowGroupingRef = {
  shiftTypeId: string;
  qualificationId: string;
  startTime: string;
  endTime: string;
};

export function bulkShiftRowsMatchForGrouping(
  a: BulkShiftRowGroupingRef,
  b: BulkShiftRowGroupingRef
): boolean {
  return (
    a.shiftTypeId === b.shiftTypeId &&
    a.qualificationId === b.qualificationId &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime
  );
}

export function isBulkShiftEmployeeSortActive(
  column: string | null,
  direction: string | null
): boolean {
  return column === "employee" && (direction === "asc" || direction === "desc");
}

/** Einfügeposition für neue Zeile in der Listen-Reihenfolge. */
export function insertBulkShiftRowInList<T extends BulkShiftRowGroupingRef>(
  rows: readonly T[],
  newRow: T,
  sortByEmployeeActive: boolean
): T[] {
  if (sortByEmployeeActive) {
    return [newRow, ...rows];
  }

  const matchIndex = rows.findIndex((row) =>
    bulkShiftRowsMatchForGrouping(row, newRow)
  );
  if (matchIndex === -1) {
    return [newRow, ...rows];
  }

  return [...rows.slice(0, matchIndex), newRow, ...rows.slice(matchIndex)];
}
