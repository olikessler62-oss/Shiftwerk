import { resolveEffectiveConfirmationStatus } from "@schichtwerk/database";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export type ShiftCardContextMenuAction =
  | "delete"
  | "cancel"
  | "reassign"
  | "resendConfirmation"
  | "setConfirmed";

export type ShiftCardContextMenuOptions = {
  shiftDate: string;
  isPastShiftDate: (shiftDate: string) => boolean;
};

const TAB_ACTIONS: Record<
  ShiftConfirmationStatus,
  readonly ShiftCardContextMenuAction[]
> = {
  proposed: ["delete"],
  requested: ["cancel"],
  confirmed: ["cancel"],
  rejected: ["reassign"],
  pending: ["cancel", "resendConfirmation"],
  canceled: ["reassign", "delete"],
};

const PAST_UNCONFIRMED_ACTIONS: readonly ShiftCardContextMenuAction[] = [
  "setConfirmed",
];

export function resolveShiftCardContextMenuStatus(
  confirmationStatus: ShiftConfirmationStatus | undefined | null,
  requestedAt?: string | null
): ShiftConfirmationStatus | undefined {
  if (!confirmationStatus) return undefined;
  return (
    resolveEffectiveConfirmationStatus(confirmationStatus, requestedAt) ??
    confirmationStatus
  );
}

export function isPastUnconfirmedShift(
  confirmationStatus: ShiftConfirmationStatus | undefined | null,
  requestedAt: string | null | undefined,
  options: ShiftCardContextMenuOptions
): boolean {
  if (!options.isPastShiftDate(options.shiftDate)) return false;
  const status = resolveShiftCardContextMenuStatus(
    confirmationStatus,
    requestedAt
  );
  return status !== undefined && status !== "confirmed";
}

export function isPastConfirmedPlanningShift(
  shift: {
    shift_date: string;
    confirmationStatus?: ShiftConfirmationStatus | null;
    requestedAt?: string | null;
  },
  isPastShiftDate: (shiftDate: string) => boolean,
  cellDate?: string
): boolean {
  const pastReferenceDate = cellDate ?? shift.shift_date;
  if (!isPastShiftDate(pastReferenceDate)) return false;
  const status = resolveShiftCardContextMenuStatus(
    shift.confirmationStatus,
    shift.requestedAt
  );
  return status === "confirmed" || status === undefined;
}

/** Vergangene Kalenderzelle: Klick/Cursor nur für unbestätigte Schichten. */
export function planningShiftCardShowsPointerCursor(
  shift: {
    shift_date: string;
    confirmationStatus?: ShiftConfirmationStatus | null;
    requestedAt?: string | null;
  },
  cellDate: string,
  isPastShiftDate: (shiftDate: string) => boolean
): boolean {
  if (!isPastShiftDate(cellDate)) return true;
  return isPastUnconfirmedShift(shift.confirmationStatus, shift.requestedAt, {
    shiftDate: shift.shift_date,
    isPastShiftDate,
  });
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
    requestedAt
  );
  if (!status) return [];
  return TAB_ACTIONS[status] ?? [];
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
    case "resendConfirmation":
      return "shiftConfirmation.actions.resendConfirmation";
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

export function shiftCardContextMenuShowsEdit(
  confirmationStatus: ShiftConfirmationStatus | undefined | null,
  requestedAt?: string | null,
  options?: ShiftCardContextMenuOptions
): boolean {
  if (
    options &&
    isPastUnconfirmedShift(confirmationStatus, requestedAt, options)
  ) {
    return false;
  }

  const status = resolveShiftCardContextMenuStatus(
    confirmationStatus,
    requestedAt
  );
  if (!status) return true;
  return status !== "pending";
}
