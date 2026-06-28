import type { ShiftConfirmationStatus } from "@schichtwerk/types";

import { isShiftDateInPast } from "./shift-cancellation";
import { resolveEffectiveConfirmationStatus } from "./shift-confirmation-pending";

/** Vergangene Schichten mit unbeantworteter Bestätigungsanfrage. */
export const UNANSWERED_SHIFT_CONFIRMATION_STATUSES = new Set<ShiftConfirmationStatus>([
  "requested",
  "pending",
]);

export type ShiftUnresolvedPastJobResult = {
  scanned: number;
  transitioned: number;
  errors: { shiftId: string; error: string }[];
};

export function shouldMarkShiftConfirmationUnresolved(
  status: ShiftConfirmationStatus | undefined | null,
  shiftDateISO: string,
  now: Date = new Date()
): boolean {
  if (!status || status === "unresolved") return false;
  if (!UNANSWERED_SHIFT_CONFIRMATION_STATUSES.has(status)) return false;
  return isShiftDateInPast(shiftDateISO, now);
}

export function resolveCalendarShiftConfirmationStatus(input: {
  status: ShiftConfirmationStatus | undefined | null;
  requestedAt?: string | null;
  shiftDateISO: string;
  now?: Date;
}): ShiftConfirmationStatus | undefined {
  if (input.status === "unresolved") return "unresolved";

  const effective =
    resolveEffectiveConfirmationStatus(
      input.status,
      input.requestedAt,
      input.now
    ) ?? input.status ?? undefined;

  if (!effective) return undefined;
  if (effective === "unresolved") return "unresolved";

  if (
    shouldMarkShiftConfirmationUnresolved(
      effective,
      input.shiftDateISO,
      input.now
    )
  ) {
    return "unresolved";
  }

  return effective;
}
