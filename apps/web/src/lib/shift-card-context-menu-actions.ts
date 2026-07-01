import { resolveEffectiveConfirmationStatus } from "@schichtwerk/database";

import type { ShiftCardDisplayState, ShiftConfirmationStatus } from "@schichtwerk/types";



import { communicationResponseTabForStatus } from "@/lib/communication-hub";

import { communicationTabActions } from "@/lib/communication-tab-actions";

import { planningShiftCardShowsPointerCursor } from "@/lib/shift-card-interaction-policy";



export { planningShiftCardShowsPointerCursor };



export type ShiftCardContextMenuAction =

  | "delete"

  | "cancel"

  | "reassign"

  | "requestConfirmation"

  | "setConfirmed";



export type ShiftCardContextMenuOptions = {
  shiftDate: string;
  /** Kalenderzelle — falls abweichend von {@link shiftDate} (z. B. Nachtschicht). */
  cellDate?: string;
  isPastShiftDate: (shiftDate: string) => boolean;
  displayState?: ShiftCardDisplayState;
  hasAbsenceConflict?: boolean;
  pendingAfterMinutes?: number;
};



const PAST_UNCONFIRMED_ACTIONS: readonly ShiftCardContextMenuAction[] = [

  "delete",

  "setConfirmed",

];



export function resolveShiftCardContextMenuStatus(

  confirmationStatus: ShiftConfirmationStatus | undefined | null,

  requestedAt?: string | null,

  displayState?: ShiftCardDisplayState,

  pendingAfterMinutes?: number

): ShiftConfirmationStatus | undefined {

  if (displayState) return displayState.legacyConfirmationStatus;

  if (!confirmationStatus) return undefined;

  return (

    resolveEffectiveConfirmationStatus(
      confirmationStatus,
      requestedAt,
      new Date(),
      pendingAfterMinutes
    ) ??

    confirmationStatus

  );

}



export function isPastUnconfirmedShift(

  confirmationStatus: ShiftConfirmationStatus | undefined | null,

  requestedAt: string | null | undefined,

  options: ShiftCardContextMenuOptions

): boolean {
  const pastReferenceDate = options.cellDate ?? options.shiftDate;
  if (!options.isPastShiftDate(pastReferenceDate)) return false;

  const status = resolveShiftCardContextMenuStatus(
    confirmationStatus,
    requestedAt,
    options.displayState,
    options.pendingAfterMinutes
  );

  return status !== undefined && status !== "confirmed";

}

export function isConfirmedShiftCard(
  confirmationStatus: ShiftConfirmationStatus | undefined | null,
  requestedAt?: string | null,
  displayState?: ShiftCardDisplayState,
  pendingAfterMinutes?: number
): boolean {
  return (
    resolveShiftCardContextMenuStatus(
      confirmationStatus,
      requestedAt,
      displayState,
      pendingAfterMinutes
    ) === "confirmed"
  );
}

export function shiftHasDisplayableAbsenceConflict(
  confirmationStatus: ShiftConfirmationStatus | undefined | null,
  requestedAt: string | null | undefined,
  options: Pick<ShiftCardContextMenuOptions, "displayState" | "hasAbsenceConflict">
): boolean {
  if (!options.hasAbsenceConflict) return false;
  return !isConfirmedShiftCard(
    confirmationStatus,
    requestedAt,
    options.displayState
  );
}

export function isPastConfirmedPlanningShift(

  shift: {

    shift_date: string;

    confirmationStatus?: ShiftConfirmationStatus | null;

    requestedAt?: string | null;

    displayState?: ShiftCardDisplayState;

  },

  isPastShiftDate: (shiftDate: string) => boolean,

  cellDate?: string,

  pendingAfterMinutes?: number

): boolean {

  const pastReferenceDate = cellDate ?? shift.shift_date;

  if (!isPastShiftDate(pastReferenceDate)) return false;

  const status = resolveShiftCardContextMenuStatus(
    shift.confirmationStatus,
    shift.requestedAt,
    shift.displayState,
    pendingAfterMinutes
  );

  return status === "confirmed" || status === undefined;

}



export type ShiftCardContextMenuOpenOptions = ShiftCardContextMenuOptions & {

  /** Ohne Schichtbestätigung: Löschen als Fallback-Menüpunkt. */

  legacyDeleteFallback?: boolean;

};



export function handleShiftCardContextMenuPointerEvent(

  event: { preventDefault(): void; stopPropagation(): void },

  canOpen: boolean,

  onOpen?: () => void

): void {

  event.preventDefault();

  event.stopPropagation();

  if (canOpen) onOpen?.();

}



export function canOpenShiftCardContextMenu(

  confirmationStatus: ShiftConfirmationStatus | undefined | null,

  requestedAt?: string | null,

  options?: ShiftCardContextMenuOpenOptions

): boolean {

  if (
    options &&
    isPastConfirmedPlanningShift(
      {
        shift_date: options.shiftDate,
        confirmationStatus,
        requestedAt,
        displayState: options.displayState,
      },
      options.isPastShiftDate,
      options.cellDate,
      options.pendingAfterMinutes
    )
  ) {
    return false;
  }

  if (

    options &&

    isPastUnconfirmedShift(confirmationStatus, requestedAt, options)

  ) {

    return true;

  }



  const status = resolveShiftCardContextMenuStatus(
    confirmationStatus,
    requestedAt,
    options?.displayState,
    options?.pendingAfterMinutes
  );



  if (status === "confirmed") {

    return (

      !!options &&
      !options.isPastShiftDate(options.cellDate ?? options.shiftDate) &&

      shiftCardContextMenuActions(confirmationStatus, requestedAt, options)

        .length > 0

    );

  }



  if (

    shiftCardContextMenuActions(confirmationStatus, requestedAt, options)

      .length > 0

  ) {

    return true;

  }



  if (options?.legacyDeleteFallback) return true;



  return false;

}



export function shiftCardContextMenuActions(

  confirmationStatus: ShiftConfirmationStatus | undefined | null,

  requestedAt?: string | null,

  options?: ShiftCardContextMenuOptions

): readonly ShiftCardContextMenuAction[] {

  if (

    options &&

    isPastUnconfirmedShift(confirmationStatus, requestedAt, options)

  ) {

    return PAST_UNCONFIRMED_ACTIONS;

  }



  const status = resolveShiftCardContextMenuStatus(
    confirmationStatus,
    requestedAt,
    options?.displayState,
    options?.pendingAfterMinutes
  );

  if (
    shiftHasDisplayableAbsenceConflict(confirmationStatus, requestedAt, {
      displayState: options?.displayState,
      hasAbsenceConflict: options?.hasAbsenceConflict,
    })
  ) {
    return communicationTabActions("conflicts") as readonly ShiftCardContextMenuAction[];
  }



  if (status === "confirmed") {
    if (
      options &&
      options.isPastShiftDate(options.cellDate ?? options.shiftDate)
    ) {
      return [];
    }

    return ["cancel"];

  }



  if (!status) return [];



  const tab = communicationResponseTabForStatus(status);

  if (!tab) return [];



  return communicationTabActions(tab) as readonly ShiftCardContextMenuAction[];

}



export function canOpenPastUnconfirmedShiftContextMenu(

  confirmationStatus: ShiftConfirmationStatus | undefined | null,

  requestedAt: string | null | undefined,

  options: ShiftCardContextMenuOptions

): boolean {

  return isPastUnconfirmedShift(confirmationStatus, requestedAt, options);

}



export function shiftCardContextMenuActionLabelKey(

  action: ShiftCardContextMenuAction

): string {

  switch (action) {

    case "delete":

      return "areaCalendar.deleteShift";

    case "cancel":

      return "shiftConfirmation.actions.cancelShiftManager";

    case "reassign":

      return "shiftConfirmation.panel.reassign";

    case "requestConfirmation":

      return "shiftConfirmation.actions.requestConfirmation";

    case "setConfirmed":

      return "shiftConfirmation.actions.setConfirmed";

  }

}



export function shiftCardAllowsRemoveFromAssignDialog(

  confirmationStatus: ShiftConfirmationStatus | undefined | null,

  requestedAt?: string | null,

  options?: ShiftCardContextMenuOptions

): boolean {

  return shiftCardContextMenuActions(confirmationStatus, requestedAt, options).includes(

    "delete"

  );

}



export function shiftCardAllowsBulkRowDelete(

  confirmationStatus: ShiftConfirmationStatus | undefined | null,

  requestedAt?: string | null,

  options?: ShiftCardContextMenuOptions

): boolean {

  return shiftCardAllowsRemoveFromAssignDialog(confirmationStatus, requestedAt, options);

}



/** @deprecated Kontextmenü „Bearbeiten“ entfällt — Primäraktion ist Linksklick. */

export function shiftCardContextMenuShowsEdit(

  confirmationStatus: ShiftConfirmationStatus | undefined | null,

  requestedAt?: string | null,

  options?: ShiftCardContextMenuOptions

): boolean {

  void confirmationStatus;

  void requestedAt;

  void options;

  return false;

}


