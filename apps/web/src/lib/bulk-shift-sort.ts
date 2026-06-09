export type BulkShiftSortRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  startTime: string;
};

/** Primär Von-Zeit; MA mit mehreren Zeilen gruppiert untereinander. */
export function sortBulkShiftRows<T extends BulkShiftSortRow>(rows: T[]): T[] {
  const byStart = [...rows].sort((a, b) => {
    const byTime = a.startTime.localeCompare(b.startTime);
    if (byTime !== 0) return byTime;
    return a.employeeName.localeCompare(b.employeeName, "de");
  });

  const grouped = new Map<string, T[]>();
  const groupOrder: string[] = [];

  for (const row of byStart) {
    const key = row.employeeId || `__empty__:${row.id}`;
    if (!grouped.has(key)) {
      groupOrder.push(key);
      grouped.set(key, []);
    }
    grouped.get(key)!.push(row);
  }

  const result: T[] = [];
  for (const key of groupOrder) {
    const group = grouped.get(key)!;
    group.sort((a, b) => a.startTime.localeCompare(b.startTime));
    result.push(...group);
  }
  return result;
}
