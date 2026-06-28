import type { ShiftConfirmationStatus } from "@schichtwerk/types";

/** Zählt für grüne Füllstandsanzeige (verbindlich bestätigt). */
export function countsTowardStaffingConfirmation(
  status: ShiftConfirmationStatus | undefined | null
): boolean {
  return status === "confirmed" || status == null;
}

/** Zählt für Bedarfsprojektion (bestätigt + offene Planung). */
export function countsTowardStaffingProjection(
  status: ShiftConfirmationStatus | undefined | null
): boolean {
  if (countsTowardStaffingConfirmation(status)) return true;
  return (
    status === "proposed" ||
    status === "requested" ||
    status === "pending" ||
    status === "unresolved"
  );
}
