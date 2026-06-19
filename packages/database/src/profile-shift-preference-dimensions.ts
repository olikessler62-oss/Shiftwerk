export type ShiftPreferenceDimensionInput = {
  weekday?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  location_id?: string | null;
  location_area_id?: string | null;
  qualification_id?: string | null;
};

export const PROFILE_SHIFT_PREFERENCE_NO_DIMENSION_ERROR =
  "Bitte mindestens eine Dimension angeben.";
export const PROFILE_SHIFT_PREFERENCE_INCOMPLETE_TIME_ERROR =
  "Zeitwunsch erfordert Wochentag, Von und Bis.";

export function shiftPreferenceHasTimeDimension(
  input: ShiftPreferenceDimensionInput
): boolean {
  return (
    input.weekday != null &&
    input.start_time != null &&
    input.start_time.trim() !== "" &&
    input.end_time != null &&
    input.end_time.trim() !== ""
  );
}

export function shiftPreferenceHasPlacementDimension(
  input: ShiftPreferenceDimensionInput
): boolean {
  return (
    input.location_id != null ||
    input.location_area_id != null ||
    input.qualification_id != null
  );
}

export function validateShiftPreferenceDimensions(
  input: ShiftPreferenceDimensionInput
): { ok: true; hasTime: boolean } | { ok: false; error: string } {
  const hasWeekday = input.weekday != null;
  const hasStart = input.start_time != null && input.start_time.trim() !== "";
  const hasEnd = input.end_time != null && input.end_time.trim() !== "";
  const hasAnyTimePart = hasWeekday || hasStart || hasEnd;

  if (hasAnyTimePart && !(hasWeekday && hasStart && hasEnd)) {
    return { ok: false, error: PROFILE_SHIFT_PREFERENCE_INCOMPLETE_TIME_ERROR };
  }

  const hasTime = hasWeekday && hasStart && hasEnd;
  const hasPlacement = shiftPreferenceHasPlacementDimension(input);

  if (!hasTime && !hasPlacement) {
    return { ok: false, error: PROFILE_SHIFT_PREFERENCE_NO_DIMENSION_ERROR };
  }

  return { ok: true, hasTime };
}

export function compareProfileShiftPreferencesBySchedule<
  T extends {
    weekday: number | null;
    start_time: string | null;
    end_time: string | null;
    id?: string;
  },
>(a: T, b: T): number {
  const weekdayA = a.weekday ?? 99;
  const weekdayB = b.weekday ?? 99;
  if (weekdayA !== weekdayB) return weekdayA - weekdayB;
  const startCmp = (a.start_time ?? "").localeCompare(b.start_time ?? "");
  if (startCmp !== 0) return startCmp;
  const endCmp = (a.end_time ?? "").localeCompare(b.end_time ?? "");
  if (endCmp !== 0) return endCmp;
  return (a.id ?? "").localeCompare(b.id ?? "");
}

export function sortProfileShiftPreferencesBySchedule<
  T extends {
    weekday: number | null;
    start_time: string | null;
    end_time: string | null;
    id?: string;
  },
>(items: readonly T[]): T[] {
  return [...items].sort(compareProfileShiftPreferencesBySchedule);
}
