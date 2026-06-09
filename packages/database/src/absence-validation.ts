export type AbsenceRange = {
  id?: string;
  employee_id: string;
  start_date: string;
  end_date: string;
};

export function validateAbsenceDateOrder(
  startDate: string,
  endDate: string
): { ok: true } | { ok: false; code: "endBeforeStart" } {
  if (startDate > endDate) {
    return { ok: false, code: "endBeforeStart" };
  }
  return { ok: true };
}

export function absenceRangesOverlap(a: AbsenceRange, b: AbsenceRange): boolean {
  if (a.employee_id !== b.employee_id) return false;
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

export function findOverlappingAbsence(
  existing: AbsenceRange[],
  candidate: AbsenceRange,
  excludeId?: string
): AbsenceRange | null {
  for (const entry of existing) {
    if (excludeId && entry.id === excludeId) continue;
    if (absenceRangesOverlap(entry, candidate)) return entry;
  }
  return null;
}

export function isDateWithinAbsenceRange(
  absence: AbsenceRange,
  date: string
): boolean {
  return absence.start_date <= date && date <= absence.end_date;
}
