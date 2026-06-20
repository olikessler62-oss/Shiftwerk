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

/** Nur heutige (noch nicht beendete) und künftige Schichten zählen für Verfügbarkeitsänderungen. */
export function isShiftRelevantForAvailabilityChange(
  shift: Pick<EmployeeShiftRecord, "shift_date" | "ends_at">,
  todayISO: string,
  now: Date = new Date()
): boolean {
  if (shift.shift_date < todayISO) return false;
  if (shift.shift_date > todayISO) return true;
  return new Date(shift.ends_at).getTime() > now.getTime();
}

export function wouldChangingAvailabilitySlotConflictWithActiveShifts(input: {
  slotBeforeChange: ProfileRecurringAvailability;
  availabilityAfterChange: readonly ProfileRecurringAvailability[];
  futureShifts: readonly EmployeeShiftRecord[];
  countryCode: string;
  timeZone: string;
  todayISO: string;
  now?: Date;
}): { ok: true } | { ok: false; error: string } {
  const {
    slotBeforeChange,
    availabilityAfterChange,
    futureShifts,
    countryCode,
    timeZone,
    todayISO,
    now = new Date(),
  } = input;

  const slotWeekday = normalizeProfileAvailabilityWeekday(slotBeforeChange.weekday);
  if (slotWeekday < 0) return { ok: true };

  for (const shift of futureShifts) {
    if (!isShiftRelevantForAvailabilityChange(shift, todayISO, now)) continue;
    if (shift.employee_id !== slotBeforeChange.profile_id) continue;

    const shiftWeekday = serviceWeekdayForShiftDate(countryCode, shift.shift_date);
    if (shiftWeekday !== slotWeekday) continue;

    const startTime = shiftTimeFromTimestamp(shift.starts_at, timeZone);
    const endTime = shiftTimeFromTimestamp(shift.ends_at, timeZone);

    if (
      !shiftWindowFitsAvailabilitySlot(
        startTime,
        endTime,
        slotBeforeChange.start_time,
        slotBeforeChange.end_time
      )
    ) {
      continue;
    }

    if (
      !employeeMatchesShiftAvailability(
        slotBeforeChange.profile_id,
        availabilityAfterChange,
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

export function wouldDeletingAvailabilitySlotConflictWithFutureShifts(input: {
  slotToDelete: ProfileRecurringAvailability;
  remainingAvailability: readonly ProfileRecurringAvailability[];
  futureShifts: readonly EmployeeShiftRecord[];
  countryCode: string;
  timeZone: string;
  todayISO: string;
  now?: Date;
}): { ok: true } | { ok: false; error: string } {
  return wouldChangingAvailabilitySlotConflictWithActiveShifts({
    slotBeforeChange: input.slotToDelete,
    availabilityAfterChange: input.remainingAvailability,
    futureShifts: input.futureShifts,
    countryCode: input.countryCode,
    timeZone: input.timeZone,
    todayISO: input.todayISO,
    now: input.now,
  });
}
