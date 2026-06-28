import {
  resolveCalendarShiftConfirmationStatus,
  resolveEffectiveConfirmationStatus,
} from "@schichtwerk/database";
import type {
  ShiftCardDisplayState,
  ShiftConfirmationStatus,
} from "@schichtwerk/types";

export function resolveShiftCardConfirmationStatusForCalendar(
  shift: {
    shift_date: string;
    confirmationStatus?: ShiftConfirmationStatus | null;
    requestedAt?: string | null;
    displayState?: ShiftCardDisplayState;
  },
  cellDateISO?: string
): ShiftConfirmationStatus | undefined {
  const base =
    shift.displayState?.legacyConfirmationStatus ??
    resolveEffectiveConfirmationStatus(
      shift.confirmationStatus,
      shift.requestedAt
    ) ??
    shift.confirmationStatus ??
    undefined;

  if (!base) return undefined;

  return resolveCalendarShiftConfirmationStatus({
    status: base,
    requestedAt: shift.requestedAt,
    shiftDateISO: cellDateISO ?? shift.shift_date,
  });
}
