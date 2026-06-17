export type ShiftPreferenceComparable = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location_area_id?: string | null;
};

export const PROFILE_SHIFT_PREFERENCE_DUPLICATE_ERROR =
  "Für diesen Wochentag existiert bereits eine Wunschzeit mit demselben Zeitfenster.";

export function shiftPreferenceTimeKey(time: string): string {
  return time.trim().slice(0, 5);
}

export function findProfileShiftPreferenceDuplicate(
  existing: readonly ShiftPreferenceComparable[],
  input: {
    weekday: number;
    start_time: string;
    end_time: string;
    location_area_id?: string | null;
  },
  excludeId?: string
): ShiftPreferenceComparable | undefined {
  const start = shiftPreferenceTimeKey(input.start_time);
  const end = shiftPreferenceTimeKey(input.end_time);
  const areaId = input.location_area_id ?? null;

  return existing.find((item) => {
    if (excludeId && item.id === excludeId) return false;
    return (
      item.weekday === input.weekday &&
      shiftPreferenceTimeKey(item.start_time) === start &&
      shiftPreferenceTimeKey(item.end_time) === end &&
      (item.location_area_id ?? null) === areaId
    );
  });
}

export function validateNoDuplicateProfileShiftPreference(
  existing: readonly ShiftPreferenceComparable[],
  input: {
    weekday: number;
    start_time: string;
    end_time: string;
    location_area_id?: string | null;
  },
  excludeId?: string
): { ok: true } | { ok: false; error: string } {
  const duplicate = findProfileShiftPreferenceDuplicate(existing, input, excludeId);
  if (duplicate) {
    return { ok: false, error: PROFILE_SHIFT_PREFERENCE_DUPLICATE_ERROR };
  }
  return { ok: true };
}
