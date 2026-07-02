import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import { cn } from "@/lib/cn";
import { STAFFING_OCHER_TEXT_CLASS } from "@/lib/staffing-ocher-styles";
import {
  SHIFT_CONFIRMATION_OVERLAY_OPACITY,
  SHIFT_CARD_UNRESOLVED_OPACITY,
  shiftConfirmationBadgeSymbol,
  shiftConfirmationShowsOverlay,
  shiftConfirmationShowsUnresolvedCardStyle,
} from "@schichtwerk/ui-tokens";

/** Vollflächiger Overlay-Schleier auf dem Karteninhalt (linker Mitarbeiter-Farbstreifen bleibt frei). */
export const SHIFT_CONFIRMATION_OVERLAY_COLOR_CLASS = "bg-black/40";

/** Status-Badge-Hintergrund (einheitlich schwarz). */
export const SHIFT_CONFIRMATION_BADGE_PANEL_CLASS = "rounded-sm bg-black";

export {
  SHIFT_CONFIRMATION_OVERLAY_OPACITY,
  SHIFT_CARD_UNRESOLVED_OPACITY,
  shiftConfirmationShowsOverlay,
  shiftConfirmationShowsUnresolvedCardStyle,
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
    case "unresolved":
      return "text-neutral-500";
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
export const SHIFT_CONFIRMATION_REQUESTED_TOOLTIP_TEXT_CLASS =
  STAFFING_OCHER_TEXT_CLASS;

/** Dunklere Tab-Überschriften im Schicht-Stati-Modal. */
export const SHIFT_CONFIRMATION_PENDING_TAB_LABEL_CLASS = "text-[#701a75]";

export const SHIFT_CONFIRMATION_REJECTED_TAB_LABEL_CLASS = "text-red-800";

export const SHIFT_CONFIRMATION_PROPOSED_TAB_LABEL_CLASS = "text-neutral-950";

export const SHIFT_CONFIRMATION_REQUESTED_TAB_LABEL_CLASS =
  STAFFING_OCHER_TEXT_CLASS;

export const SHIFT_CONFIRMATION_CONFIRMED_TAB_LABEL_CLASS = "text-green-600";

export const SHIFT_CONFIRMATION_CANCELED_TAB_LABEL_CLASS = "text-orange-700";

export const SHIFT_CONFIRMATION_CANCELED_TOOLTIP_TEXT_CLASS = "text-orange-800";

/** Tooltip-Status bei offener MA-Absage (Schicht faktisch noch bestätigt). */
export const SHIFT_CONFIRMATION_EMPLOYEE_CANCELLATION_PENDING_TOOLTIP_TEXT_CLASS =
  "text-orange-800";

export const SHIFT_CONFIRMATION_UNRESOLVED_TOOLTIP_TEXT_CLASS = "text-neutral-600";

export const SHIFT_CONFIRMATION_UNRESOLVED_TAB_LABEL_CLASS = "text-neutral-700";

/** Punktfarben in Listen/Header — abgestimmt auf Tab- und Tabellen-Statusfarben. */
export const SHIFT_CONFIRMATION_REQUESTED_DOT_CLASS = "bg-[#7A5A10]";
export const SHIFT_CONFIRMATION_PENDING_DOT_CLASS = "bg-[#701a75]";
export const SHIFT_CONFIRMATION_REJECTED_DOT_CLASS = "bg-red-800";
export const SHIFT_CONFIRMATION_CANCELED_DOT_CLASS = "bg-orange-700";
export const SHIFT_CONFIRMATION_UNRESOLVED_DOT_CLASS = "bg-neutral-600";

export function shiftConfirmationConflictDotClass(
  status: ShiftConfirmationStatus
): string {
  switch (status) {
    case "requested":
      return SHIFT_CONFIRMATION_REQUESTED_DOT_CLASS;
    case "pending":
      return SHIFT_CONFIRMATION_PENDING_DOT_CLASS;
    case "rejected":
      return SHIFT_CONFIRMATION_REJECTED_DOT_CLASS;
    case "canceled":
      return SHIFT_CONFIRMATION_CANCELED_DOT_CLASS;
    case "unresolved":
      return SHIFT_CONFIRMATION_UNRESOLVED_DOT_CLASS;
    default:
      return "bg-foreground/45";
  }
}

const SHIFT_CONFIRMATION_ROW_CHIP_BASE_CLASS =
  "inline-flex shrink-0 items-center gap-0.5 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums";

export function shiftConfirmationRowChipClass(
  status: ShiftConfirmationStatus
): string {
  switch (status) {
    case "requested":
      return cn(
        SHIFT_CONFIRMATION_ROW_CHIP_BASE_CLASS,
        "border-amber-200/90 bg-amber-50",
        STAFFING_OCHER_TEXT_CLASS
      );
    case "pending":
      return cn(
        SHIFT_CONFIRMATION_ROW_CHIP_BASE_CLASS,
        "border-fuchsia-200/90 bg-fuchsia-50 text-[#701a75]"
      );
    case "rejected":
      return cn(
        SHIFT_CONFIRMATION_ROW_CHIP_BASE_CLASS,
        "border-red-200 bg-red-50 text-red-800"
      );
    case "canceled":
      return cn(
        SHIFT_CONFIRMATION_ROW_CHIP_BASE_CLASS,
        "border-orange-200 bg-orange-50 text-orange-800"
      );
    case "unresolved":
      return cn(
        SHIFT_CONFIRMATION_ROW_CHIP_BASE_CLASS,
        "border-neutral-200 bg-neutral-100 text-neutral-600"
      );
    default:
      return SHIFT_CONFIRMATION_ROW_CHIP_BASE_CLASS;
  }
}

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
    case "unresolved":
      return SHIFT_CONFIRMATION_UNRESOLVED_TOOLTIP_TEXT_CLASS;
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
  if (status === "unresolved") {
    return SHIFT_CONFIRMATION_UNRESOLVED_TOOLTIP_TEXT_CLASS;
  }
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
