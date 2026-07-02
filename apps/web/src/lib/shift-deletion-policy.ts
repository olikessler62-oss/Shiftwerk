import type { Translator } from "@schichtwerk/i18n/translate";

import {
  hasPendingEmployeeCancellation,
  resolveEffectiveConfirmationStatus,
} from "@schichtwerk/database";

import type { ShiftCardDisplayState, ShiftConfirmationStatus } from "@schichtwerk/types";

import { shiftConfirmationStatusLabelKey } from "@/lib/shift-confirmation-display";



export const SHIFT_DELETE_BLOCKED_ERROR_PREFIX = "SHIFT_DELETE_BLOCKED:";



export function canDeleteShiftByConfirmationStatus(

  status: ShiftConfirmationStatus | undefined | null

): boolean {

  return status === "proposed" || status === "rejected" || status === "canceled";

}



export function canDeleteShift(input: {

  shiftDate: string;

  confirmationStatus?: ShiftConfirmationStatus | null;

  requestedAt?: string | null;

  isPastShiftDate: (shiftDate: string, startTime?: string | null) => boolean;

  shiftStartTime?: string | null;

  pendingAfterMinutes?: number;

  displayState?: ShiftCardDisplayState | null;

}): boolean {

  if (hasPendingEmployeeCancellation(input.displayState)) {
    return true;
  }

  const effectiveStatus = resolveEffectiveConfirmationStatus(
    input.confirmationStatus,
    input.requestedAt,
    new Date(),
    input.pendingAfterMinutes
  );



  if (input.isPastShiftDate(input.shiftDate, input.shiftStartTime)) {

    return effectiveStatus !== undefined && effectiveStatus !== "confirmed";

  }



  return canDeleteShiftByConfirmationStatus(effectiveStatus);

}



export function shiftDeleteBlockedActionError(

  status: ShiftConfirmationStatus

): string {

  return `${SHIFT_DELETE_BLOCKED_ERROR_PREFIX}${status}`;

}



export function parseShiftDeleteBlockedStatus(

  message: string

): ShiftConfirmationStatus | null {

  if (!message.startsWith(SHIFT_DELETE_BLOCKED_ERROR_PREFIX)) return null;

  const status = message.slice(SHIFT_DELETE_BLOCKED_ERROR_PREFIX.length);

  if (

    status === "proposed" ||

    status === "requested" ||

    status === "confirmed" ||

    status === "rejected" ||

    status === "pending" ||

    status === "canceled"

  ) {

    return status;

  }

  return null;

}



export function shiftDeleteBlockedMessage(

  status: ShiftConfirmationStatus,

  t: Translator

): string {

  return t("shiftConfirmation.deleteBlockedByStatus", {

    status: t(shiftConfirmationStatusLabelKey(status)),

  });

}


