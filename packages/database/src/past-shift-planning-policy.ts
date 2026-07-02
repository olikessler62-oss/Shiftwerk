import { organizationTodayISO } from "./organization-timezone";
import { zonedWallClockToUtc } from "./shift-timestamps";

export type PlanningShiftMomentInput = {
  shiftDateISO: string;
  startTime?: string | null;
  startsAt?: string | null;
};

function normalizePlanningStartTime(
  startTime: string | null | undefined
): string | null {
  const trimmed = startTime?.trim();
  if (!trimmed || trimmed === "—" || trimmed === "–") return null;
  if (!/^\d{1,2}:\d{2}/.test(trimmed)) return null;
  return trimmed;
}

export function resolvePlanningShiftStartInstant(
  input: PlanningShiftMomentInput,
  timeZone: string
): Date | null {
  if (input.startsAt) {
    const parsed = new Date(input.startsAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const startTime = normalizePlanningStartTime(input.startTime);
  if (!startTime) return null;

  return zonedWallClockToUtc(input.shiftDateISO, startTime, timeZone);
}

/** Schichtbeginn liegt in der Vergangenheit (Kalendertag oder Uhrzeit auf „heute“). */
export function isPlanningShiftMomentInPast(
  input: PlanningShiftMomentInput,
  timeZone: string,
  now: Date = new Date()
): boolean {
  const todayISO = organizationTodayISO(timeZone, now);
  if (input.shiftDateISO < todayISO) return true;
  if (input.shiftDateISO > todayISO) return false;

  const start = resolvePlanningShiftStartInstant(input, timeZone);
  if (!start) return false;

  return start.getTime() < now.getTime();
}

export function isOrganizationShiftDateInPast(
  shiftDateISO: string,
  todayISO: string
): boolean {
  return shiftDateISO < todayISO;
}

export function shouldBlockPastPlanningShiftEdit(
  input: PlanningShiftMomentInput,
  timeZone: string,
  allowPastShiftChanges: boolean,
  now: Date = new Date()
): boolean {
  if (allowPastShiftChanges) return false;
  return isPlanningShiftMomentInPast(input, timeZone, now);
}

export function shouldSuppressEmployeeShiftNotification(
  input: PlanningShiftMomentInput,
  timeZone: string,
  now: Date = new Date()
): boolean {
  return isPlanningShiftMomentInPast(input, timeZone, now);
}

export function shouldSuppressEmployeeShiftNotificationNow(
  input: PlanningShiftMomentInput,
  timeZone: string,
  now: Date = new Date()
): boolean {
  return shouldSuppressEmployeeShiftNotification(input, timeZone, now);
}
