import {
  isEmployeeRespondableConfirmationStatus,
  isShiftDateInPast,
} from "@schichtwerk/database";
import type { Shift } from "@schichtwerk/types";

/** Offene Bestätigungsanfrage, die in der Mobile-UI gezählt/angeboten wird. */
export function isOpenEmployeeConfirmationShift(shift: Shift): boolean {
  return (
    isEmployeeRespondableConfirmationStatus(shift.confirmation_status) &&
    !isShiftDateInPast(shift.shift_date)
  );
}
