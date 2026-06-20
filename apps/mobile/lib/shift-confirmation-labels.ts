import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import { colors } from "@schichtwerk/ui-tokens";

const STATUS_LABELS: Record<ShiftConfirmationStatus, string> = {
  proposed: "Geplant",
  requested: "Bestätigung angefragt",
  confirmed: "Bestätigt",
  rejected: "Abgelehnt",
  pending: "Antwort ausstehend",
  canceled: "Abgesagt",
};

const SHORT_STATUS_LABELS: Record<ShiftConfirmationStatus, string> = {
  proposed: "Geplant",
  requested: "Angefragt",
  confirmed: "Bestätigt",
  rejected: "Abgelehnt",
  pending: "Ausstehend",
  canceled: "Abgesagt",
};

export function shiftConfirmationStatusLabel(
  status: ShiftConfirmationStatus
): string {
  return STATUS_LABELS[status] ?? status;
}

export function shiftConfirmationStatusShortLabel(
  status: ShiftConfirmationStatus
): string {
  return SHORT_STATUS_LABELS[status] ?? status;
}

export function shiftConfirmationStatusBadgeBackground(
  status: ShiftConfirmationStatus
): string {
  switch (status) {
    case "requested":
    case "pending":
      return "#FEF3C7";
    case "confirmed":
      return "#DCFCE7";
    case "rejected":
      return "#FEE2E2";
    case "canceled":
      return "#FFEDD5";
    default:
      return colors.background;
  }
}
