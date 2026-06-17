export type AbsenceRange = {
  id?: string;
  employee_id: string;
  start_date: string;
  end_date: string | null;
  is_open_ended?: boolean;
};

export const ABSENCE_OPEN_ENDED_EFFECTIVE_END = "9999-12-31";
export const ABSENCE_SHIFT_CONFLICT_HORIZON_DAYS = 90;

export function addDaysISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function effectiveAbsenceEndDate(range: AbsenceRange): string {
  if (range.is_open_ended && !range.end_date) {
    return ABSENCE_OPEN_ENDED_EFFECTIVE_END;
  }
  return range.end_date ?? ABSENCE_OPEN_ENDED_EFFECTIVE_END;
}

export function absenceRangeForShiftConflict(
  range: AbsenceRange,
  referenceDateISO: string
): { employee_id: string; start_date: string; end_date: string } {
  if (range.is_open_ended && !range.end_date) {
    return {
      employee_id: range.employee_id,
      start_date: range.start_date,
      end_date: addDaysISO(referenceDateISO, ABSENCE_SHIFT_CONFLICT_HORIZON_DAYS),
    };
  }
  return {
    employee_id: range.employee_id,
    start_date: range.start_date,
    end_date: range.end_date!,
  };
}

export function validateAbsenceDateOrder(
  startDate: string,
  endDate: string | null,
  isOpenEnded = false
): { ok: true } | { ok: false; code: "endBeforeStart" | "missingEnd" } {
  if (isOpenEnded && !endDate) {
    return { ok: true };
  }
  if (!endDate) {
    return { ok: false, code: "missingEnd" };
  }
  if (startDate > endDate) {
    return { ok: false, code: "endBeforeStart" };
  }
  return { ok: true };
}

export function validateOpenEndedSickOnly(
  type: string,
  isOpenEnded: boolean
): { ok: true } | { ok: false; code: "openEndedNotSick" } {
  if (isOpenEnded && type !== "sick") {
    return { ok: false, code: "openEndedNotSick" };
  }
  return { ok: true };
}

export function absenceRangesOverlap(a: AbsenceRange, b: AbsenceRange): boolean {
  if (a.employee_id !== b.employee_id) return false;
  const aEnd = effectiveAbsenceEndDate(a);
  const bEnd = effectiveAbsenceEndDate(b);
  return a.start_date <= bEnd && b.start_date <= aEnd;
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
  if (date < absence.start_date) return false;
  if (absence.is_open_ended && !absence.end_date) return true;
  if (!absence.end_date) return true;
  return date <= absence.end_date;
}

export function absenceRequestToRange(
  absence: Pick<
    AbsenceRange,
    "employee_id" | "start_date" | "end_date" | "is_open_ended"
  > & { id?: string }
): AbsenceRange {
  return {
    id: absence.id,
    employee_id: absence.employee_id,
    start_date: absence.start_date,
    end_date: absence.end_date,
    is_open_ended: absence.is_open_ended ?? false,
  };
}
