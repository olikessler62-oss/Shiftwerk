import type { ShiftConfirmationStatus } from "@schichtwerk/types";

/** MA sieht Schichten erst nach Versand der Bestätigungsanfrage — nicht im Status proposed. */
export function isEmployeeVisibleConfirmationStatus(
  status: ShiftConfirmationStatus
): boolean {
  return status !== "proposed";
}
