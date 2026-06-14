import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export function shiftConfirmationShowsOverlay(
  status: ShiftConfirmationStatus | undefined | null
): boolean {
  return (
    status === "proposed" ||
    status === "requested" ||
    status === "pending" ||
    status === "rejected"
  );
}

export function shiftConfirmationBadgeSymbol(
  status: ShiftConfirmationStatus
): string {
  switch (status) {
    case "proposed":
      return "⋯";
    case "requested":
      return "?";
    case "pending":
      return "⏱";
    case "rejected":
      return "✕";
    default:
      return "";
  }
}

export function shiftConfirmationStatusLabelKey(
  status: ShiftConfirmationStatus
): `shiftConfirmation.status.${ShiftConfirmationStatus}` {
  return `shiftConfirmation.status.${status}`;
}
