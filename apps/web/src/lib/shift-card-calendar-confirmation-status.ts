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
  cellDateISO?: string,
  pendingAfterMinutes?: number
): ShiftConfirmationStatus | undefined {
  const base =
    shift.displayState?.legacyConfirmationStatus ??
    resolveEffectiveConfirmationStatus(
      shift.confirmationStatus,
      shift.requestedAt,
      new Date(),
      pendingAfterMinutes
    ) ??
    shift.confirmationStatus ??
    undefined;

  if (!base) return undefined;

  return resolveCalendarShiftConfirmationStatus({
    status: base,
    requestedAt: shift.requestedAt,
    shiftDateISO: cellDateISO ?? shift.shift_date,
    pendingAfterMinutes,
  });
}
