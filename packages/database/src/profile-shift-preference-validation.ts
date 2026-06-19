import {
  shiftPreferenceHasTimeDimension,
  type ShiftPreferenceDimensionInput,
} from "./profile-shift-preference-dimensions";

export type ShiftPreferenceComparable = ShiftPreferenceDimensionInput & {
  id: string;
};

export const PROFILE_SHIFT_PREFERENCE_DUPLICATE_ERROR =
  "Für diesen Wunsch existiert bereits ein identischer Eintrag.";

export function shiftPreferenceTimeKey(time: string | null | undefined): string {
  if (!time) return "";
  return time.trim().slice(0, 5);
}

function shiftPreferencePlacementKey(input: ShiftPreferenceDimensionInput): string {
  return [
    input.location_id ?? "",
    input.location_area_id ?? "",
    input.qualification_id ?? "",
  ].join("|");
}

export function findProfileShiftPreferenceDuplicate(
  existing: readonly ShiftPreferenceComparable[],
  input: ShiftPreferenceDimensionInput,
  excludeId?: string
): ShiftPreferenceComparable | undefined {
  const inputHasTime = shiftPreferenceHasTimeDimension(input);
  const inputPlacementKey = shiftPreferencePlacementKey(input);

  return existing.find((item) => {
    if (excludeId && item.id === excludeId) return false;

    const itemHasTime = shiftPreferenceHasTimeDimension(item);
    if (inputHasTime !== itemHasTime) return false;

    if (inputHasTime) {
      return (
        item.weekday === input.weekday &&
        shiftPreferenceTimeKey(item.start_time) ===
          shiftPreferenceTimeKey(input.start_time) &&
        shiftPreferenceTimeKey(item.end_time) ===
          shiftPreferenceTimeKey(input.end_time) &&
        shiftPreferencePlacementKey(item) === inputPlacementKey
      );
    }

    return shiftPreferencePlacementKey(item) === inputPlacementKey;
  });
}

export function validateNoDuplicateProfileShiftPreference(
  existing: readonly ShiftPreferenceComparable[],
  input: ShiftPreferenceDimensionInput,
  excludeId?: string
): { ok: true } | { ok: false; error: string } {
  const duplicate = findProfileShiftPreferenceDuplicate(existing, input, excludeId);
  if (duplicate) {
    return { ok: false, error: PROFILE_SHIFT_PREFERENCE_DUPLICATE_ERROR };
  }
  return { ok: true };
}
