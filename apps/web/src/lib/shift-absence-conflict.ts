import {
  absenceRequestToRange,
  isDateWithinAbsenceRange,
} from "@schichtwerk/database";
import type { AbsenceRequest, AbsenceType } from "@schichtwerk/types";

type ShiftRef = {
  id: string;
  employeeId: string;
  shift_date: string;
};

export type ShiftAbsenceConflict = {
  shiftId: string;
  employeeId: string;
  shiftDate: string;
  absenceType: AbsenceType;
  absenceId: string;
};

export function findShiftAbsenceConflict(
  shift: ShiftRef,
  absences: readonly AbsenceRequest[]
): ShiftAbsenceConflict | null {
  for (const absence of absences) {
    if (absence.status !== "approved") continue;
    if (absence.employee_id !== shift.employeeId) continue;
    const range = absenceRequestToRange(absence);
    if (!isDateWithinAbsenceRange(range, shift.shift_date)) continue;
    return {
      shiftId: shift.id,
      employeeId: shift.employeeId,
      shiftDate: shift.shift_date,
      absenceType: absence.type,
      absenceId: absence.id,
    };
  }
  return null;
}

export function isShiftInAbsenceConflict(
  shift: ShiftRef,
  absences: readonly AbsenceRequest[]
): boolean {
  return findShiftAbsenceConflict(shift, absences) != null;
}

export function collectShiftAbsenceConflicts(
  shifts: readonly ShiftRef[],
  absences: readonly AbsenceRequest[]
): ShiftAbsenceConflict[] {
  const conflicts: ShiftAbsenceConflict[] = [];
  for (const shift of shifts) {
    const conflict = findShiftAbsenceConflict(shift, absences);
    if (conflict) conflicts.push(conflict);
  }
  conflicts.sort((a, b) => {
    const dateDiff = a.shiftDate.localeCompare(b.shiftDate);
    if (dateDiff !== 0) return dateDiff;
    return a.shiftId.localeCompare(b.shiftId);
  });
  return conflicts;
}

export function absenceTypeLabelKey(
  type: AbsenceType
): "settings.absences.typeVacation" | "settings.absences.typeSick" | "settings.absences.typeOther" {
  switch (type) {
    case "vacation":
      return "settings.absences.typeVacation";
    case "sick":
      return "settings.absences.typeSick";
    case "other":
      return "settings.absences.typeOther";
  }
}

/** Visuelles Signal auf Schichtkarten bei Abwesenheits-Konflikt. */
export const SHIFT_ABSENCE_CONFLICT_RING_CLASS =
  "ring-2 ring-rose-500 ring-offset-1";

export const SHIFT_ABSENCE_CONFLICT_BADGE_CLASS =
  "rounded-sm bg-rose-600 px-1 text-[10px] font-semibold leading-tight text-white";
