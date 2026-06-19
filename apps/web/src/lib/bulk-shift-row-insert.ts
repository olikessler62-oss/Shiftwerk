export type BulkShiftRowGroupingRef = {
  shiftTypeId: string;
  qualificationId: string;
  startTime: string;
  endTime: string;
};

export type BulkShiftRowPartitionRef = BulkShiftRowGroupingRef & {
  existingShiftId?: string;
};

export function isExistingBulkShiftRow(row: {
  existingShiftId?: string;
}): boolean {
  return Boolean(row.existingShiftId);
}

export function partitionBulkShiftRows<T extends { existingShiftId?: string }>(
  rows: readonly T[]
): { newRows: T[]; existingRows: T[] } {
  const newRows: T[] = [];
  const existingRows: T[] = [];
  for (const row of rows) {
    if (isExistingBulkShiftRow(row)) {
      existingRows.push(row);
    } else {
      newRows.push(row);
    }
  }
  return { newRows, existingRows };
}

export function mergeBulkShiftRowPartitions<T>(
  newRows: readonly T[],
  existingRows: readonly T[]
): T[] {
  return [...newRows, ...existingRows];
}

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

/** Einfügeposition für neue Zeile innerhalb der Sektion „Neue Zuweisungen“. */
export function insertBulkShiftRowInNewSection<T extends BulkShiftRowGroupingRef>(
  newRows: readonly T[],
  newRow: T,
  sortByEmployeeActive: boolean
): T[] {
  if (sortByEmployeeActive) {
    return [newRow, ...newRows];
  }

  const matchIndex = newRows.findIndex((row) =>
    bulkShiftRowsMatchForGrouping(row, newRow)
  );
  if (matchIndex === -1) {
    return [newRow, ...newRows];
  }

  return [...newRows.slice(0, matchIndex), newRow, ...newRows.slice(matchIndex)];
}

/** Einfügeposition für neue Zeile — nur oben bei neuen Zuweisungen, nie bei bestehenden Schichten. */
export function insertBulkShiftRowInList<T extends BulkShiftRowPartitionRef>(
  rows: readonly T[],
  newRow: T,
  sortByEmployeeActive: boolean
): T[] {
  const { newRows, existingRows } = partitionBulkShiftRows(rows);
  return mergeBulkShiftRowPartitions(
    insertBulkShiftRowInNewSection(newRows, newRow, sortByEmployeeActive),
    existingRows
  );
}
