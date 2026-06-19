import type { Translator } from "@schichtwerk/i18n/translate";

import { resolveEffectiveConfirmationStatus } from "@schichtwerk/database";

import type { ShiftConfirmationStatus } from "@schichtwerk/types";

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

  isPastShiftDate: (shiftDate: string) => boolean;

}): boolean {

  const effectiveStatus = resolveEffectiveConfirmationStatus(

    input.confirmationStatus,

    input.requestedAt

  );



  if (input.isPastShiftDate(input.shiftDate)) {

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


