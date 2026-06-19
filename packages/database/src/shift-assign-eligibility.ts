import type { AbsenceRequest, ProfileRecurringAvailability } from "@schichtwerk/types";
import {
  absenceRequestToRange,
  isDateWithinAbsenceRange,
} from "./absence-validation";
import { parseAvailabilityTimeRange, timeToMinutes } from "./profile-availability-validation";
import { weekdayIndexFromDate } from "./location-staffing";

const MINUTES_PER_DAY = 24 * 60;

type TimeSegment = { start: number; end: number };

function areaCalendarTimeKey(raw: string): string {
  const trimmed = raw.trim();
  const parts = trimmed.split(":");
  const hRaw = parts[0] ?? "00";
  const mRaw = (parts[1] ?? "00").slice(0, 2);
  return `${hRaw.padStart(2, "0")}:${mRaw.padStart(2, "0")}`;
}

function availabilitySegments(start_time: string, end_time: string): TimeSegment[] {
  const startM = timeToMinutes(start_time);
  const endM = timeToMinutes(end_time);
  if (endM > startM) {
    return [{ start: startM, end: endM }];
  }
  if (endM < startM) {
    return [
      { start: startM, end: MINUTES_PER_DAY },
      { start: 0, end: endM },
    ];
  }
  return [];
}

function availabilityRangeContainedInWindow(
  innerStart: string,
  innerEnd: string,
  outerStart: string,
  outerEnd: string
): boolean {
  const outer = availabilitySegments(outerStart, outerEnd);
  const inner = availabilitySegments(innerStart, innerEnd);
  if (!inner.length || !outer.length) return false;

  for (const segInner of inner) {
    let contained = false;
    for (const segOuter of outer) {
      if (segInner.start >= segOuter.start && segInner.end <= segOuter.end) {
        contained = true;
        break;
      }
    }
    if (!contained) return false;
  }
  return true;
}

function normalizeProfileAvailabilityWeekday(weekday: number | string): number {
  const value = typeof weekday === "number" ? weekday : Number.parseInt(String(weekday), 10);
  return Number.isInteger(value) ? value : -1;
}

export function shiftWindowFitsAvailabilitySlot(
  shiftStart: string,
  shiftEnd: string,
  slotStart: string,
  slotEnd: string
): boolean {
  return availabilityRangeContainedInWindow(
    areaCalendarTimeKey(shiftStart),
    areaCalendarTimeKey(shiftEnd),
    areaCalendarTimeKey(slotStart),
    areaCalendarTimeKey(slotEnd)
  );
}

export function areShiftAssignTimesComplete(startTime: string, endTime: string): boolean {
  return parseAvailabilityTimeRange({
    start_time: areaCalendarTimeKey(startTime),
    end_time: areaCalendarTimeKey(endTime),
  }).ok;
}

export function isEmployeeAbsentOnDate(
  employeeId: string,
  absences: readonly AbsenceRequest[],
  dateISO: string
): boolean {
  for (const absence of absences) {
    if (absence.status !== "approved") continue;
    if (absence.employee_id !== employeeId) continue;
    const range = absenceRequestToRange(absence);
    if (isDateWithinAbsenceRange(range, dateISO)) return true;
  }
  return false;
}

export function employeeHasRecurringAvailabilityOnWeekday(
  employeeId: string,
  availability: readonly ProfileRecurringAvailability[],
  weekday: number
): boolean {
  return availability.some(
    (slot) =>
      slot.profile_id === employeeId &&
      normalizeProfileAvailabilityWeekday(slot.weekday) === weekday
  );
}

export function employeeMatchesShiftAvailability(
  employeeId: string,
  availability: readonly ProfileRecurringAvailability[],
  weekday: number,
  startTime: string,
  endTime: string
): boolean {
  if (!areShiftAssignTimesComplete(startTime, endTime)) return false;
  return availability.some(
    (slot) =>
      slot.profile_id === employeeId &&
      normalizeProfileAvailabilityWeekday(slot.weekday) === weekday &&
      shiftWindowFitsAvailabilitySlot(
        startTime,
        endTime,
        slot.start_time,
        slot.end_time
      )
  );
}

export function validateEmployeeNotAbsentOnDate(
  employeeId: string,
  absences: readonly AbsenceRequest[],
  dateISO: string
): { ok: true } | { ok: false; error: string } {
  if (isEmployeeAbsentOnDate(employeeId, absences, dateISO)) {
    return {
      ok: false,
      error: "Personal ist an diesem Tag abwesend.",
    };
  }
  return { ok: true };
}

export function validateEmployeeShiftAvailability(
  employeeId: string,
  availability: readonly ProfileRecurringAvailability[],
  weekday: number,
  startTime: string,
  endTime: string
): { ok: true } | { ok: false; error: string } {
  if (!areShiftAssignTimesComplete(startTime, endTime)) {
    return { ok: false, error: "Ungültige Schichtzeiten." };
  }

  if (!employeeHasRecurringAvailabilityOnWeekday(employeeId, availability, weekday)) {
    return {
      ok: false,
      error: "Personal hat an diesem Wochentag keine Verfügbarkeit.",
    };
  }

  if (!employeeMatchesShiftAvailability(employeeId, availability, weekday, startTime, endTime)) {
    return {
      ok: false,
      error: "Schichtzeit liegt außerhalb der Verfügbarkeit des Personals.",
    };
  }

  return { ok: true };
}

export { weekdayIndexFromDate as shiftAssignWeekdayFromDate };
