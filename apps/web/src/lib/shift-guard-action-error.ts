import { PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR } from "@schichtwerk/database";

type TranslateFn = (key: string) => string;

export function resolveShiftGuardActionError(error: string, t: TranslateFn): string {
  if (error === PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR) {
    return t("profiles.availabilityDeleteShiftConflict");
  }
  return error;
}

/** @deprecated Use resolveShiftGuardActionError */
export const resolveProfileAvailabilityActionError = resolveShiftGuardActionError;
