import type { ShiftCardDisplayState, ShiftConfirmationStatus } from "@schichtwerk/types";

import type { CommunicationHubCategory } from "@/lib/communication-hub";
import {
  isPastUnconfirmedShift,
  resolveShiftCardContextMenuStatus,
  shiftHasDisplayableAbsenceConflict,
} from "@/lib/shift-card-context-menu-actions";

export type ShiftCardPlanningInput = {
  id?: string;
  shift_date: string;
  confirmationStatus?: ShiftConfirmationStatus | null;
  requestedAt?: string | null;
  displayState?: ShiftCardDisplayState;
};

export type ShiftCardInteractionContext = {
  shiftDate: string;
  cellDate: string;
  isPastShiftDate: (shiftDate: string) => boolean;
  shiftConfirmationEnabled: boolean;
  hasAbsenceConflict?: boolean;
  hasSwapRequest?: boolean;
  displayState?: ShiftCardDisplayState;
};

export type ShiftCardInteractionOptions = {
  shiftConfirmationEnabled?: boolean;
  hasAbsenceConflict?: boolean;
  hasSwapRequest?: boolean;
};

export type ShiftCardPrimaryClick =
  | { kind: "edit" }
  | { kind: "communicationHub"; category: CommunicationHubCategory }
  | { kind: "reassign" }
  | { kind: "none" };

export function resolveShiftCardInteractionContext(
  shift: ShiftCardPlanningInput,
  cellDate: string,
  isPastShiftDate: (shiftDate: string) => boolean,
  options?: ShiftCardInteractionOptions
): ShiftCardInteractionContext {
  return {
    shiftDate: shift.shift_date,
    cellDate,
    isPastShiftDate,
    shiftConfirmationEnabled: options?.shiftConfirmationEnabled ?? true,
    hasAbsenceConflict: options?.hasAbsenceConflict,
    hasSwapRequest: options?.hasSwapRequest,
    displayState: shift.displayState,
  };
}

export function resolveShiftCardPrimaryClick(
  shift: ShiftCardPlanningInput,
  context: ShiftCardInteractionContext
): ShiftCardPrimaryClick {
  if (!context.shiftConfirmationEnabled) {
    if (
      isPastUnconfirmedShift(
        shift.confirmationStatus,
        shift.requestedAt,
        context
      )
    ) {
      return { kind: "none" };
    }
    return { kind: "edit" };
  }

  if (
    isPastUnconfirmedShift(shift.confirmationStatus, shift.requestedAt, context)
  ) {
    return { kind: "none" };
  }

  if (
    shiftHasDisplayableAbsenceConflict(shift.confirmationStatus, shift.requestedAt, {
      displayState: context.displayState,
      hasAbsenceConflict: context.hasAbsenceConflict,
    })
  ) {
    return { kind: "communicationHub", category: "conflicts" };
  }

  if (context.hasSwapRequest) {
    return { kind: "communicationHub", category: "swaps" };
  }

  const status = resolveShiftCardContextMenuStatus(
    shift.confirmationStatus,
    shift.requestedAt,
    context.displayState
  );

  switch (status) {
    case "proposed":
      return { kind: "edit" };
    case "requested":
      return { kind: "communicationHub", category: "requested" };
    case "pending":
    case "confirmed":
      return { kind: "none" };
    case "rejected":
      return { kind: "communicationHub", category: "rejected" };
    case "canceled":
      return { kind: "communicationHub", category: "canceled" };
    default:
      return { kind: "edit" };
  }
}

export function shiftCardShowsPointerCursor(
  shift: ShiftCardPlanningInput,
  context: ShiftCardInteractionContext
): boolean {
  return resolveShiftCardPrimaryClick(shift, context).kind !== "none";
}

export function planningShiftCardShowsPointerCursor(
  shift: ShiftCardPlanningInput,
  cellDate: string,
  isPastShiftDate: (shiftDate: string) => boolean,
  options?: ShiftCardInteractionOptions
): boolean {
  const context = resolveShiftCardInteractionContext(
    shift,
    cellDate,
    isPastShiftDate,
    options
  );
  return shiftCardShowsPointerCursor(shift, context);
}
