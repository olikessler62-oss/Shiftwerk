import type { ShiftConfirmationStatus, ShiftRequestActorRole } from "@schichtwerk/types";
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

function canceledStatusLabel(
  cancelledBy: ShiftRequestActorRole | undefined,
  long: boolean
): string {
  if (cancelledBy === "manager") {
    return "Storniert";
  }
  return long ? STATUS_LABELS.canceled : SHORT_STATUS_LABELS.canceled;
}

export function shiftConfirmationStatusLabel(
  status: ShiftConfirmationStatus,
  cancelledBy?: ShiftRequestActorRole
): string {
  if (status === "canceled") {
    return canceledStatusLabel(cancelledBy, true);
  }
  return STATUS_LABELS[status] ?? status;
}

export function shiftConfirmationStatusShortLabel(
  status: ShiftConfirmationStatus,
  cancelledBy?: ShiftRequestActorRole
): string {
  if (status === "canceled") {
    return canceledStatusLabel(cancelledBy, false);
  }
  return SHORT_STATUS_LABELS[status] ?? status;
}

export const EMPLOYEE_CANCELLATION_SENT_SHORT_LABEL = "Absage gesendet";

export function employeeCancellationSentShortLabel(): string {
  return EMPLOYEE_CANCELLATION_SENT_SHORT_LABEL;
}

export function employeeCancellationSentBadgeBackground(): string {
  return "#FFEDD5";
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
