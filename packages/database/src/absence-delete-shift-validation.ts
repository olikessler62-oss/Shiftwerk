import type { AbsenceRequest } from "@schichtwerk/types";
import {
  absenceRangeForShiftConflict,
  absenceRequestToRange,
  type AbsenceRange,
} from "./absence-validation";
import { PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR } from "./profile-availability-delete-validation";

export function absenceDeleteShiftConflictRange(
  range: AbsenceRange,
  todayISO: string
): { employee_id: string; start_date: string; end_date: string } | null {
  const mapped = absenceRangeForShiftConflict(range, todayISO);
  if (mapped.end_date < todayISO) return null;

  const start_date = mapped.start_date < todayISO ? todayISO : mapped.start_date;
  if (start_date > mapped.end_date) return null;

  return {
    employee_id: mapped.employee_id,
    start_date,
    end_date: mapped.end_date,
  };
}

export function wouldDeletingAbsenceConflictWithFutureShifts(input: {
  absence: Pick<
    AbsenceRequest,
    "employee_id" | "start_date" | "end_date" | "is_open_ended"
  >;
  shiftCount: number;
}): { ok: true } | { ok: false; error: string } {
  if (input.shiftCount > 0) {
    return { ok: false, error: PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR };
  }
  return { ok: true };
}

export function absenceDeleteShiftConflictRangeFromRequest(
  absence: Pick<
    AbsenceRequest,
    "employee_id" | "start_date" | "end_date" | "is_open_ended"
  >,
  todayISO: string
): { employee_id: string; start_date: string; end_date: string } | null {
  return absenceDeleteShiftConflictRange(absenceRequestToRange(absence), todayISO);
}
