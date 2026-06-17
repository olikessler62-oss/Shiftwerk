import type { ShiftConfirmationStatus } from "@schichtwerk/types";

/** Vollflächiger Overlay-Schleier auf dem Karteninhalt (linker Mitarbeiter-Farbstreifen bleibt frei). */
export const SHIFT_CONFIRMATION_OVERLAY_COLOR_CLASS = "bg-black/40";

/** Status-Badge-Hintergrund (einheitlich schwarz). */
export const SHIFT_CONFIRMATION_BADGE_PANEL_CLASS = "rounded-sm bg-black";

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

export function shiftConfirmationBadgeSymbolClass(
  status: ShiftConfirmationStatus
): string {
  switch (status) {
    case "proposed":
      return "text-white";
    case "requested":
      return "text-yellow-400";
    case "pending":
      return "text-[#c294d0] drop-shadow-[0_0_3px_rgba(194,148,208,0.95)]";
    case "rejected":
      return "text-fuchsia-500";
    default:
      return "text-white";
  }
}

/** Tooltip-Textfarbe für Status „Ausstehend“ (wie Badge-Symbol auf der Karte). */
export const SHIFT_CONFIRMATION_PENDING_TOOLTIP_TEXT_CLASS = "text-[#a21caf]";

/** Tooltip-Textfarbe für Status „Bestätigt“. */
export const SHIFT_CONFIRMATION_CONFIRMED_TOOLTIP_TEXT_CLASS = "text-green-600";

export function shiftConfirmationTooltipStatusTextClass(
  status: ShiftConfirmationStatus | undefined
): string {
  switch (status) {
    case "pending":
      return SHIFT_CONFIRMATION_PENDING_TOOLTIP_TEXT_CLASS;
    case "confirmed":
      return SHIFT_CONFIRMATION_CONFIRMED_TOOLTIP_TEXT_CLASS;
    default:
      return "";
  }
}

export function shiftConfirmationStatusLabelKey(
  status: ShiftConfirmationStatus
): `shiftConfirmation.status.${ShiftConfirmationStatus}` {
  return `shiftConfirmation.status.${status}`;
}
