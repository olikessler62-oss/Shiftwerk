import type { EmployeeWeekShiftDisplayItem, Shift } from "@schichtwerk/types";

/** Stornierte Schicht aus dem Mitarbeiter-Wochenplan entfernen (Ausblenden). */
export function isEmployeeDismissableShift(
  shift: Shift,
  display?: EmployeeWeekShiftDisplayItem
): boolean {
  if (shift.confirmation_status === "canceled") return true;
  if (shift.lifecycle_status === "cancelled") return true;
  if (display?.cancelledBy != null) return true;
  return false;
}
