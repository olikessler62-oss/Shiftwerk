import type { ShiftConfirmationStatus } from "@schichtwerk/types";

import { isShiftDateInPast } from "./shift-cancellation";

export type ShiftPastProposedCleanupJobResult = {
  scanned: number;
  deleted: number;
  errors: { shiftId: string; error: string }[];
};

/** Vergangene „Geplant“-Schichten werden nicht mehr im Planungskalender angezeigt. */
export function shouldAutoRemovePastProposedShift(
  confirmationStatus: ShiftConfirmationStatus | undefined | null,
  shiftDateISO: string,
  now: Date = new Date()
): boolean {
  if (confirmationStatus !== "proposed") return false;
  return isShiftDateInPast(shiftDateISO, now);
}
