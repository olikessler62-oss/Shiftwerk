import { DEFAULT_PROFILE_WEEKLY_HOURS, resolveProfileWeeklyHoursTarget } from "./employee-weekly-hours-validation";
import { shiftDurationHours } from "./shift-type-break-rules";

export const LEGAL_MAX_WEEKLY_WORKING_HOURS_DE = 48;

export type ProfileAvailabilitySlotRef = {
  start_time: string;
  end_time: string;
};

export type ProfileWeeklyHoursLimitViolation =
  | {
      kind: "legal_weekly_hours_exceeded";
      hours: number;
      legalMax: number;
    }
  | {
      kind: "availability_exceeds_legal";
      hours: number;
      legalMax: number;
    }
  | {
      kind: "availability_exceeds_target";
      hours: number;
      targetHours: number;
    };

export function resolveLegalMaxWeeklyWorkingHours(
  countryCode: string | null | undefined
): number {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized || normalized === "DE") {
    return LEGAL_MAX_WEEKLY_WORKING_HOURS_DE;
  }
  return LEGAL_MAX_WEEKLY_WORKING_HOURS_DE;
}

export function availabilitySlotDurationHours(
  start_time: string,
  end_time: string
): number {
  return shiftDurationHours(start_time.slice(0, 5), end_time.slice(0, 5));
}

export function sumProfileAvailabilityMaxWeeklyHours(
  slots: readonly ProfileAvailabilitySlotRef[]
): number {
  let total = 0;
  for (const slot of slots) {
    total += availabilitySlotDurationHours(slot.start_time, slot.end_time);
  }
  return Math.round(total * 10) / 10;
}

function roundHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

export function formatLegalWeeklyHoursExceededError(input: {
  hours: number;
  legalMax: number;
}): string {
  return `Gesetzliche Höchstarbeitszeit überschritten — ${roundHours(input.hours)} Std. (Maximum ${roundHours(input.legalMax)} Std.).`;
}

export function formatAvailabilityExceedsTargetError(input: {
  hours: number;
  targetHours: number;
}): string {
  return `Verfügbarkeiten erlauben ${roundHours(input.hours)} Std./Woche — über dem Soll von ${roundHours(input.targetHours)} Std.`;
}

export function validateProfileWeeklyHoursLegalLimit(input: {
  weeklyHours: number;
  countryCode?: string | null;
}):
  | { ok: true }
  | { ok: false; error: string; violation: ProfileWeeklyHoursLimitViolation } {
  const legalMax = resolveLegalMaxWeeklyWorkingHours(input.countryCode);
  if (input.weeklyHours <= legalMax) {
    return { ok: true };
  }
  const violation: ProfileWeeklyHoursLimitViolation = {
    kind: "legal_weekly_hours_exceeded",
    hours: input.weeklyHours,
    legalMax,
  };
  return {
    ok: false,
    error: formatLegalWeeklyHoursExceededError(violation),
    violation,
  };
}

export function evaluateProfileAvailabilityWeeklyLimits(input: {
  availabilities: readonly ProfileAvailabilitySlotRef[];
  weeklyHoursTarget: number | null | undefined;
  countryCode?: string | null;
}): {
  availabilityHours: number;
  targetHours: number;
  legalMax: number;
  violations: ProfileWeeklyHoursLimitViolation[];
} {
  const legalMax = resolveLegalMaxWeeklyWorkingHours(input.countryCode);
  const targetHours = resolveProfileWeeklyHoursTarget(input.weeklyHoursTarget);
  const availabilityHours = sumProfileAvailabilityMaxWeeklyHours(input.availabilities);
  const violations: ProfileWeeklyHoursLimitViolation[] = [];

  if (availabilityHours > legalMax) {
    violations.push({
      kind: "availability_exceeds_legal",
      hours: availabilityHours,
      legalMax,
    });
  } else if (availabilityHours > targetHours) {
    violations.push({
      kind: "availability_exceeds_target",
      hours: availabilityHours,
      targetHours,
    });
  }

  return {
    availabilityHours,
    targetHours,
    legalMax,
    violations,
  };
}

export function validateProfileWeeklyHoursInput(input: {
  weekly_hours: number | null;
  countryCode?: string | null;
}):
  | { ok: true; weekly_hours: number | null }
  | { ok: false; error: string } {
  if (input.weekly_hours == null) {
    return { ok: true, weekly_hours: null };
  }
  const legalCheck = validateProfileWeeklyHoursLegalLimit({
    weeklyHours: input.weekly_hours,
    countryCode: input.countryCode,
  });
  if (!legalCheck.ok) {
    return { ok: false, error: legalCheck.error };
  }
  return { ok: true, weekly_hours: input.weekly_hours };
}

export function defaultProfileWeeklyHoursForCreate(): number {
  return DEFAULT_PROFILE_WEEKLY_HOURS;
}
