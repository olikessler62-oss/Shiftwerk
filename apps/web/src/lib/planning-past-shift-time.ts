import {
  isPlanningShiftMomentInPast,
  type PlanningShiftMomentInput,
} from "@schichtwerk/database";

export type PlanningPastShiftChecker = {
  isMomentInPast: (input: PlanningShiftMomentInput) => boolean;
  isBlockedForPlanning: (input: PlanningShiftMomentInput) => boolean;
  /** Kalender-Moment in der Vergangenheit — unabhängig von allowPastShiftChanges (z. B. Storno). */
  isShiftMomentInPast: (shiftDate: string, startTime?: string | null) => boolean;
  isPastShiftDate: (shiftDate: string, startTime?: string | null) => boolean;
};

export function createPlanningPastShiftChecker(
  allowPastShiftChanges: boolean,
  timeZone: string,
  now: Date = new Date()
): PlanningPastShiftChecker {
  const isMomentInPast = (input: PlanningShiftMomentInput) =>
    isPlanningShiftMomentInPast(input, timeZone, now);

  const isBlockedForPlanning = (input: PlanningShiftMomentInput) =>
    !allowPastShiftChanges && isMomentInPast(input);

  const isPastShiftDate = (shiftDate: string, startTime?: string | null) =>
    isBlockedForPlanning({ shiftDateISO: shiftDate, startTime });

  const isShiftMomentInPast = (shiftDate: string, startTime?: string | null) =>
    isMomentInPast({ shiftDateISO: shiftDate, startTime });

  return {
    isMomentInPast,
    isBlockedForPlanning,
    isShiftMomentInPast,
    isPastShiftDate,
  };
}

export function planningMomentFromStaffingRow(input: {
  dateISO: string;
  timeFrom?: string | null;
}): PlanningShiftMomentInput {
  return {
    shiftDateISO: input.dateISO,
    startTime: input.timeFrom,
  };
}

export function planningMomentFromShift(input: {
  shift_date: string;
  startTime?: string | null;
  starts_at?: string | null;
}): PlanningShiftMomentInput {
  return {
    shiftDateISO: input.shift_date,
    startTime: input.startTime,
    startsAt: input.starts_at ?? null,
  };
}
