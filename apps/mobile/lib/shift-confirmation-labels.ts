import type { ShiftConfirmationStatus } from "@schichtwerk/types";

const STATUS_LABELS: Record<ShiftConfirmationStatus, string> = {
  proposed: "Geplant",
  requested: "Bestätigung angefordert",
  confirmed: "Bestätigt",
  rejected: "Abgelehnt",
  pending: "Antwort ausstehend",
  canceled: "Abgesagt",
};

export function shiftConfirmationStatusLabel(
  status: ShiftConfirmationStatus
): string {
  return STATUS_LABELS[status] ?? status;
}
