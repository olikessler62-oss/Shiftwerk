import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import { shiftConfirmationBadgeTextColor } from "@schichtwerk/ui-tokens";

/** Kalender: vergangene Tage */
export const WEEK_PLAN_PAST = {
  rowDivider: "#d9dcdd",
  columnBackground: "#e2e8f0",
  dayLabelText: "#585d68",
  shiftCardBackground: "#d4d4d4",
  shiftCardText: "#585d68",
} as const;

/** Kalender: heutiger und zukünftiger Tag */
export const WEEK_PLAN_ACTIVE = {
  rowDivider: "#e2e8f0",
  columnBackground: "#ffffff",
  dayLabelText: "#25262b",
  /** Heutiger Tag — Primary #0F3558 */
  todayLabelText: "#0F3558",
  shiftCardText: "#000000",
} as const;

/** Schichtkarten-Inhalt (Schicht, Zeit, Standort/Bereich/Job) nach Status */
export const SHIFT_CARD_STATUS_CONTENT_TEXT = {
  proposedOrConfirmed: {
    past: "#4f535d",
    active: "#000000",
  },
  other: {
    past: "#2f2d2d",
    active: "#000000",
  },
} as const;

export function resolveShiftCardContentTextColor(
  status: ShiftConfirmationStatus,
  isPastDay: boolean
): string {
  const palette =
    status === "proposed" || status === "confirmed"
      ? SHIFT_CARD_STATUS_CONTENT_TEXT.proposedOrConfirmed
      : SHIFT_CARD_STATUS_CONTENT_TEXT.other;
  return isPastDay ? palette.past : palette.active;
}

/** Vergangene Tage: Badge-Text für Stati außer proposed/confirmed */
export const SHIFT_CARD_PAST_OTHER_STATUS_BADGE_TEXT = "#E2E8F0";

export function shouldMutePastShiftCardStatusBadge(
  status: ShiftConfirmationStatus,
  isPastDay: boolean
): boolean {
  return (
    isPastDay && status !== "proposed" && status !== "confirmed"
  );
}

/** Status-Badge: nur „Geplant“ (proposed) anpassen; sonst unveränderte Statusfarben. */
export function resolveShiftCardStatusBadgeTextColor(
  status: ShiftConfirmationStatus,
  isPastDay: boolean
): string {
  if (shouldMutePastShiftCardStatusBadge(status, isPastDay)) {
    return SHIFT_CARD_PAST_OTHER_STATUS_BADGE_TEXT;
  }
  if (status === "proposed") {
    return resolveShiftCardContentTextColor(status, isPastDay);
  }
  return shiftConfirmationBadgeTextColor(status);
}

/** Texte um 2 % der Kartenbreite nach rechts eingerückt. */
export const SHIFT_CARD_CONTENT_INSET_RIGHT_RATIO = 0.02;
