import {
  isPlanningShiftMomentInPast,
  type PlanningShiftMomentInput,
} from "@schichtwerk/database";

export type PlanningPastShiftChecker = {
  isMomentInPast: (input: PlanningShiftMomentInput) => boolean;
  isBlockedForPlanning: (input: PlanningShiftMomentInput) => boolean;
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

  return { isMomentInPast, isBlockedForPlanning, isPastShiftDate };
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
