import type { EmployeeWeekShiftDisplayItem, Shift } from "@schichtwerk/types";

function isShiftCanceled(shift: Shift): boolean {
  return (
    shift.confirmation_status === "canceled" ||
    shift.lifecycle_status === "cancelled"
  );
}

/** Stornierte Schicht aus dem Mitarbeiter-Wochenplan entfernen (Ausblenden). */
export function isEmployeeDismissableShift(
  shift: Shift,
  _display?: EmployeeWeekShiftDisplayItem
): boolean {
  return isShiftCanceled(shift);
}

export function isEmployeeCancellationPending(
  shift: Shift,
  display?: EmployeeWeekShiftDisplayItem
): boolean {
  if (isShiftCanceled(shift)) return false;
  return display?.cancellationPending === true;
}
