import type { Translator } from "@schichtwerk/i18n/translate";
import {
  canCancelShiftByConfirmationStatus,
  parseShiftCancelBlockedStatus,
  SHIFT_CANCEL_PAST_ERROR,
  SHIFT_PAST_CONFIRM_ALREADY_CONFIRMED_ERROR,
  SHIFT_PAST_CONFIRM_NOT_PAST_ERROR,
} from "@schichtwerk/database";
import type { ShiftConfirmationStatus, ShiftRequestActorRole } from "@schichtwerk/types";
import { shiftConfirmationStatusLabelKey } from "@/lib/shift-confirmation-display";

export function resolvePlanningShiftCancelActor(input: {
  id: string;
  cancelActors?: ReadonlyMap<string, ShiftRequestActorRole>;
  cancelledBy?: ShiftRequestActorRole;
}): ShiftRequestActorRole | undefined {
  return input.cancelledBy ?? input.cancelActors?.get(input.id);
}

export function shouldDisplayShiftOnPlanningCalendar(input: {
  id: string;
  confirmationStatus?: ShiftConfirmationStatus | null;
  cancelActors?: ReadonlyMap<string, ShiftRequestActorRole>;
  cancelledBy?: ShiftRequestActorRole;
}): boolean {
  if (input.confirmationStatus !== "canceled") return true;
  return resolvePlanningShiftCancelActor(input) !== "manager";
}

export function canCancelShift(input: {
  shiftDate: string;
  confirmationStatus?: ShiftConfirmationStatus | null;
  requestedAt?: string | null;
  isPastShiftDate: (shiftDate: string) => boolean;
}): boolean {
  if (input.isPastShiftDate(input.shiftDate)) return false;
  return canCancelShiftByConfirmationStatus(
    input.confirmationStatus,
    input.requestedAt
  );
}

export function shiftCancelBlockedMessage(
  status: ShiftConfirmationStatus,
  t: Translator
): string {
  return t("shiftConfirmation.cancel.blockedByStatus", {
    status: t(shiftConfirmationStatusLabelKey(status)),
  });
}

export function translateShiftCancelError(message: string, t: Translator): string {
  if (message === SHIFT_CANCEL_PAST_ERROR) {
    return t("shiftConfirmation.cancel.pastShift");
  }

  const blockedStatus = parseShiftCancelBlockedStatus(message);
  if (blockedStatus) {
    return shiftCancelBlockedMessage(blockedStatus, t);
  }

  return message;
}

export function translatePastConfirmError(message: string, t: Translator): string {
  if (message === SHIFT_PAST_CONFIRM_NOT_PAST_ERROR) {
    return t("shiftConfirmation.pastConfirm.notPast");
  }
  if (message === SHIFT_PAST_CONFIRM_ALREADY_CONFIRMED_ERROR) {
    return t("shiftConfirmation.pastConfirm.alreadyConfirmed");
  }
  return message;
}
