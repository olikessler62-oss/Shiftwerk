import type { ShiftConfirmationStatus } from "@schichtwerk/types";

/** Vollflächiger Overlay-Schleier auf dem Karteninhalt (linker Mitarbeiter-Farbstreifen bleibt frei). */
export const SHIFT_CONFIRMATION_OVERLAY_COLOR_CLASS = "bg-black/40";

/** Vertieft wirkendes Status-Badge (dunkelgrau–schwarz, inset-Rand). */
export const SHIFT_CONFIRMATION_BADGE_PANEL_CLASS =
  "rounded-sm border border-t-neutral-950 border-l-neutral-950 border-b-neutral-600 border-r-neutral-600 bg-[#2a2a2a] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.55),inset_-1px_-1px_1px_rgba(255,255,255,0.07)]";

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
      return "text-orange-400";
    case "rejected":
      return "text-fuchsia-500";
    default:
      return "text-white";
  }
}

export function shiftConfirmationStatusLabelKey(
  status: ShiftConfirmationStatus
): `shiftConfirmation.status.${ShiftConfirmationStatus}` {
  return `shiftConfirmation.status.${status}`;
}
