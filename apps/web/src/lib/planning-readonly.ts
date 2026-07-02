import { parseISODate } from "@/lib/dates";
import { createPlanningPastShiftChecker } from "@/lib/planning-past-shift-time";

/** True, wenn der letzte Tag der Woche vor heute liegt (nur Ansicht). */
export function isPastWeek(weekEndISO: string): boolean {
  const end = parseISODate(weekEndISO);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
}

/** Kalendertag vor heute (ohne Uhrzeit) — nur noch für reine Ansichtsfilter. */
export function isPastShiftDate(shiftDateISO: string): boolean {
  const d = parseISODate(shiftDateISO);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

/** Planungs-UI: zeitgenaue Vergangenheitsprüfung inkl. Schichtbeginn. */
export function createPlanningIsPastShiftDate(
  allowPastShiftChanges: boolean,
  timeZone: string,
  now: Date = new Date()
) {
  return createPlanningPastShiftChecker(
    allowPastShiftChanges,
    timeZone,
    now
  ).isPastShiftDate;
}

export function isPlanningReadOnlyWeek(  readOnlyWeek: boolean,
  allowPastShiftChanges: boolean
): boolean {
  return !allowPastShiftChanges && readOnlyWeek;
}
