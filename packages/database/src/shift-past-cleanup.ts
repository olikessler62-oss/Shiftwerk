import { resolveEffectiveConfirmationStatus } from "./shift-confirmation-pending";
import { isShiftDateInPast } from "./shift-cancellation";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export const SHIFT_PAST_CONFIRM_NOT_PAST_ERROR =
  "SHIFT_PAST_CONFIRM_NOT_PAST";
export const SHIFT_PAST_CONFIRM_ALREADY_CONFIRMED_ERROR =
  "SHIFT_PAST_CONFIRM_ALREADY_CONFIRMED";

export function canConfirmPastShiftAsManager(input: {
  shiftDate: string;
  confirmationStatus?: ShiftConfirmationStatus | null;
  requestedAt?: string | null;
  now?: Date;
}): boolean {
  if (!isShiftDateInPast(input.shiftDate, input.now)) return false;
  const effective = resolveEffectiveConfirmationStatus(
    input.confirmationStatus,
    input.requestedAt,
    input.now
  );
  return effective !== undefined && effective !== "confirmed";
}

export function assertCanConfirmPastShiftAsManager(input: {
  shiftDate: string;
  confirmationStatus?: ShiftConfirmationStatus | null;
  requestedAt?: string | null;
  now?: Date;
}): void {
  if (!isShiftDateInPast(input.shiftDate, input.now)) {
    throw new Error(SHIFT_PAST_CONFIRM_NOT_PAST_ERROR);
  }
  if (
    !canConfirmPastShiftAsManager({
      shiftDate: input.shiftDate,
      confirmationStatus: input.confirmationStatus,
      requestedAt: input.requestedAt,
      now: input.now,
    })
  ) {
    throw new Error(SHIFT_PAST_CONFIRM_ALREADY_CONFIRMED_ERROR);
  }
}
