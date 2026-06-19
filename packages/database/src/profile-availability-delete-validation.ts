import type { EmployeeShiftRecord, ProfileRecurringAvailability } from "@schichtwerk/types";
import { serviceWeekdayForShiftDate } from "./shift-service-hours";
import {
  employeeMatchesShiftAvailability,
  shiftWindowFitsAvailabilitySlot,
} from "./shift-assign-eligibility";
import { shiftTimeFromTimestamp } from "./shift-timestamps";

export const PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR =
  "Für diese Verfügbarkeit existieren noch Schichtzuweisungen. Bitte bearbeiten Sie zuerst die betroffenen Schichten.";

function normalizeProfileAvailabilityWeekday(weekday: number | string): number {
  const value =
    typeof weekday === "number" ? weekday : Number.parseInt(String(weekday), 10);
  return Number.isInteger(value) ? value : -1;
}

export function wouldDeletingAvailabilitySlotConflictWithFutureShifts(input: {
  slotToDelete: ProfileRecurringAvailability;
  remainingAvailability: readonly ProfileRecurringAvailability[];
  futureShifts: readonly EmployeeShiftRecord[];
  countryCode: string;
  timeZone: string;
  todayISO: string;
}): { ok: true } | { ok: false; error: string } {
  const {
    slotToDelete,
    remainingAvailability,
    futureShifts,
    countryCode,
    timeZone,
    todayISO,
  } = input;

  const deleteWeekday = normalizeProfileAvailabilityWeekday(slotToDelete.weekday);
  if (deleteWeekday < 0) return { ok: true };

  for (const shift of futureShifts) {
    if (shift.shift_date < todayISO) continue;
    if (shift.employee_id !== slotToDelete.profile_id) continue;

    const shiftWeekday = serviceWeekdayForShiftDate(countryCode, shift.shift_date);
    if (shiftWeekday !== deleteWeekday) continue;

    const startTime = shiftTimeFromTimestamp(shift.starts_at, timeZone);
    const endTime = shiftTimeFromTimestamp(shift.ends_at, timeZone);

    if (
      !shiftWindowFitsAvailabilitySlot(
        startTime,
        endTime,
        slotToDelete.start_time,
        slotToDelete.end_time
      )
    ) {
      continue;
    }

    if (
      !employeeMatchesShiftAvailability(
        slotToDelete.profile_id,
        remainingAvailability,
        shiftWeekday,
        startTime,
        endTime
      )
    ) {
      return { ok: false, error: PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR };
    }
  }

  return { ok: true };
}
