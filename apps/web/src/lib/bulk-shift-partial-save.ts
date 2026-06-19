export type BulkShiftPartialSaveRow = {
  id: string;
  employeeId: string;
  startTime: string;
  endTime: string;
};

export type BulkShiftPartialSaveFailure = {
  name: string;
  startTime: string;
  endTime: string;
  error: string;
};

export type BulkShiftPartialSaveBatchFailure = {
  rowIndex: number;
  error: string;
};

/** Ab mehr als dieser Anzahl Einträge wird die Liste im Meldungsmodal gescrollt. */
export const BULK_SHIFT_PARTIAL_SAVE_SCROLL_ENTRY_THRESHOLD = 4;

export function bulkShiftPartialSaveListShouldScroll(
  entryCount: number
): boolean {
  return entryCount > BULK_SHIFT_PARTIAL_SAVE_SCROLL_ENTRY_THRESHOLD;
}

export function resolveBulkShiftPartialSaveOutcome(input: {
  currentRows: readonly BulkShiftPartialSaveRow[];
  payloadRows: readonly { row: BulkShiftPartialSaveRow; payloadIndex: number }[];
  failedResults: readonly BulkShiftPartialSaveBatchFailure[];
  resolveEmployeeName: (employeeId: string) => string;
  createEmptyRow: () => BulkShiftPartialSaveRow;
}): {
  remainingRows: BulkShiftPartialSaveRow[];
  failures: BulkShiftPartialSaveFailure[];
} {
  const failedByPayloadIndex = new Map<number, string>();
  for (const entry of input.failedResults) {
    failedByPayloadIndex.set(entry.rowIndex, entry.error);
  }

  const submittedRowIds = new Set(input.payloadRows.map(({ row }) => row.id));
  const failedRowIds = new Set<string>();
  const failures: BulkShiftPartialSaveFailure[] = [];

  for (const { payloadIndex, row } of input.payloadRows) {
    const error = failedByPayloadIndex.get(payloadIndex);
    if (!error) continue;
    failedRowIds.add(row.id);
    failures.push({
      name: input.resolveEmployeeName(row.employeeId),
      startTime: row.startTime,
      endTime: row.endTime,
      error,
    });
  }

  const remainingRows = input.currentRows.filter((row) => {
    if (!submittedRowIds.has(row.id)) return true;
    return failedRowIds.has(row.id);
  });

  return {
    remainingRows:
      remainingRows.length > 0 ? [...remainingRows] : [input.createEmptyRow()],
    failures,
  };
}

export function formatBulkShiftPartialSaveMessage(
  failures: readonly BulkShiftPartialSaveFailure[],
  translate: (key: string, params?: Record<string, string | number>) => string
): string {
  const intro = translate("areaCalendar.bulkShiftPartialSuccess");
  if (failures.length === 0) {
    return intro;
  }

  const entries = failures.map((failure) =>
    translate("areaCalendar.bulkShiftPartialSuccessEntry", {
      name: failure.name,
      start: failure.startTime.slice(0, 5),
      end: failure.endTime.slice(0, 5),
      error: failure.error,
    })
  );
  return [intro, ...entries].join("\n\n");
}
