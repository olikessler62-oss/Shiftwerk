import type { ShiftConfirmationStatus } from "@schichtwerk/types";

/** Vollflächiger Overlay-Schleier auf dem Karteninhalt (wie Web: bg-black/40). */
export const SHIFT_CONFIRMATION_OVERLAY_OPACITY = 0.4;

export function shiftConfirmationShowsOverlay(
  status: ShiftConfirmationStatus | undefined | null
): boolean {
  return (
    status === "proposed" ||
    status === "requested" ||
    status === "pending" ||
    status === "rejected" ||
    status === "canceled"
  );
}

/** Vergangene Schichten mit unbeantworteter Anfrage — halbtransparent, ohne Overlay. */
export const SHIFT_CARD_UNRESOLVED_OPACITY = 0.5;

export function shiftConfirmationShowsUnresolvedCardStyle(
  status: ShiftConfirmationStatus | undefined | null
): boolean {
  return status === "unresolved";
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
    case "canceled":
      return "⊘";
    case "unresolved":
      return "!";
    default:
      return "";
  }
}

export function shiftConfirmationBadgeTextColor(
  status: ShiftConfirmationStatus
): string {
  switch (status) {
    case "proposed":
      return "#FFFFFF";
    case "requested":
      return "#FACC15";
    case "pending":
      return "#C294D0";
    case "rejected":
      return "#D946EF";
    case "canceled":
      return "#FB923C";
    default:
      return "#FFFFFF";
  }
}
