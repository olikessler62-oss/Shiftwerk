import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import {
  SHIFT_CONFIRMATION_OVERLAY_OPACITY,
  shiftConfirmationBadgeSymbol,
  shiftConfirmationShowsOverlay,
} from "@schichtwerk/ui-tokens";

/** Vollflächiger Overlay-Schleier auf dem Karteninhalt (linker Mitarbeiter-Farbstreifen bleibt frei). */
export const SHIFT_CONFIRMATION_OVERLAY_COLOR_CLASS = "bg-black/40";

/** Status-Badge-Hintergrund (einheitlich schwarz). */
export const SHIFT_CONFIRMATION_BADGE_PANEL_CLASS = "rounded-sm bg-black";

export {
  SHIFT_CONFIRMATION_OVERLAY_OPACITY,
  shiftConfirmationShowsOverlay,
  shiftConfirmationBadgeSymbol,
};

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
    case "canceled":
      return "text-orange-400";
    default:
      return "text-white";
  }
}

/** Tooltip-Textfarbe für Status „Ausstehend“ (wie Badge-Symbol auf der Karte). */
export const SHIFT_CONFIRMATION_PENDING_TOOLTIP_TEXT_CLASS = "text-[#701a75]";

/** Tooltip-Textfarbe für Status „Bestätigt“. */
export const SHIFT_CONFIRMATION_CONFIRMED_TOOLTIP_TEXT_CLASS = "text-green-600";

export const SHIFT_CONFIRMATION_REJECTED_TOOLTIP_TEXT_CLASS = "text-red-800";

export const SHIFT_CONFIRMATION_PROPOSED_TOOLTIP_TEXT_CLASS = "text-neutral-950";

/** Dunkles Ocker — Tab „Bestätigung angefragt“ und Status in der Tabelle. */
export const SHIFT_CONFIRMATION_REQUESTED_TOOLTIP_TEXT_CLASS = "text-[#7A5A10]";

/** Dunklere Tab-Überschriften im Schicht-Stati-Modal. */
export const SHIFT_CONFIRMATION_PENDING_TAB_LABEL_CLASS = "text-[#701a75]";

export const SHIFT_CONFIRMATION_REJECTED_TAB_LABEL_CLASS = "text-red-800";

export const SHIFT_CONFIRMATION_PROPOSED_TAB_LABEL_CLASS = "text-neutral-950";

export const SHIFT_CONFIRMATION_REQUESTED_TAB_LABEL_CLASS = "text-[#7A5A10]";

export const SHIFT_CONFIRMATION_CONFIRMED_TAB_LABEL_CLASS = "text-green-600";

export const SHIFT_CONFIRMATION_CANCELED_TAB_LABEL_CLASS = "text-orange-700";

export const SHIFT_CONFIRMATION_CANCELED_TOOLTIP_TEXT_CLASS = "text-orange-800";

export function shiftConfirmationTooltipStatusTextClass(
  status: ShiftConfirmationStatus | undefined
): string {
  switch (status) {
    case "pending":
      return SHIFT_CONFIRMATION_PENDING_TOOLTIP_TEXT_CLASS;
    case "confirmed":
      return SHIFT_CONFIRMATION_CONFIRMED_TOOLTIP_TEXT_CLASS;
    case "rejected":
      return SHIFT_CONFIRMATION_REJECTED_TOOLTIP_TEXT_CLASS;
    case "proposed":
      return SHIFT_CONFIRMATION_PROPOSED_TOOLTIP_TEXT_CLASS;
    case "requested":
      return SHIFT_CONFIRMATION_REQUESTED_TOOLTIP_TEXT_CLASS;
    case "canceled":
      return SHIFT_CONFIRMATION_CANCELED_TOOLTIP_TEXT_CLASS;
    default:
      return "";
  }
}

/** Inline-/Tooltip-Status für vergangene Schichtkarten (Dashboard, Bereich-Kalender). */
export const SHIFT_CONFIRMATION_PAST_SHIFT_STATUS_TEXT_CLASS = "text-neutral-600";

export function shiftConfirmationCardStatusTextClass(
  status: ShiftConfirmationStatus | undefined,
  isPastShift: boolean
): string {
  if (isPastShift) {
    return SHIFT_CONFIRMATION_PAST_SHIFT_STATUS_TEXT_CLASS;
  }
  return shiftConfirmationTooltipStatusTextClass(status);
}

export function shiftConfirmationStatusLabelKey(
  status: ShiftConfirmationStatus
): `shiftConfirmation.status.${ShiftConfirmationStatus}` {
  return `shiftConfirmation.status.${status}`;
}

export function shiftConfirmationTooltipStatusLabelKey(
  status: ShiftConfirmationStatus
): `shiftConfirmation.tooltipStatus.${ShiftConfirmationStatus}` {
  return `shiftConfirmation.tooltipStatus.${status}`;
}

export function formatDashboardShiftCardInlineStatusLabel(
  formatStatusTooltipLine: (statusText: string) => string,
  formatStatusText: (key: ReturnType<typeof shiftConfirmationTooltipStatusLabelKey>) => string,
  status: ShiftConfirmationStatus
): string {
  return formatStatusTooltipLine(
    formatStatusText(shiftConfirmationTooltipStatusLabelKey(status))
  );
}
