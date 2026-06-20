import { PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR } from "@schichtwerk/database";
import {
  isAvailabilityExceedsTargetError,
  isLegalWeeklyHoursLimitError,
  parseAvailabilityExceedsTargetError,
} from "@/lib/profile-weekly-hours-blocking-errors";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function parseLegalWeeklyHoursExceeded(error: string): { hours: string; legalMax: string } | null {
  const match = error.match(
    /Gesetzliche Höchstarbeitszeit überschritten — ([0-9]+(?:[.,][0-9]+)?) Std\. \(Maximum ([0-9]+(?:[.,][0-9]+)?) Std\.\)\./
  );
  if (!match) return null;
  return { hours: match[1], legalMax: match[2] };
}

function parseAvailabilityExceedsTarget(
  error: string
): { hours: string; targetHours: string } | null {
  return parseAvailabilityExceedsTargetError(error);
}

export function resolveShiftGuardActionError(error: string, t: TranslateFn): string {
  if (error === PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR) {
    return t("profiles.availabilityDeleteShiftConflict");
  }

  if (isLegalWeeklyHoursLimitError(error)) {
    const parsed = parseLegalWeeklyHoursExceeded(error);
    if (parsed) {
      return t("profiles.legalWeeklyHoursExceeded", parsed);
    }
  }

  if (isAvailabilityExceedsTargetError(error)) {
    const parsed = parseAvailabilityExceedsTarget(error);
    if (parsed) {
      return t("profiles.availabilityExceedsTarget", parsed);
    }
  }

  return error;
}

/** @deprecated Use resolveShiftGuardActionError */
export const resolveProfileAvailabilityActionError = resolveShiftGuardActionError;
