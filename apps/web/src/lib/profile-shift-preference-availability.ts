import { shiftWindowFitsAvailabilitySlot } from "@schichtwerk/database";
import type {
  ProfileRecurringAvailability,
  ProfileShiftPreference,
} from "@schichtwerk/types";

export function profileShiftPreferenceFitsAvailability(
  preference: ProfileShiftPreference,
  availability: readonly ProfileRecurringAvailability[]
): boolean {
  const daySlots = availability.filter((slot) => slot.weekday === preference.weekday);
  if (daySlots.length === 0) return false;

  return daySlots.some((slot) =>
    shiftWindowFitsAvailabilitySlot(
      preference.start_time,
      preference.end_time,
      slot.start_time,
      slot.end_time
    )
  );
}

export function findNonConformantProfileShiftPreferences(
  preferences: readonly ProfileShiftPreference[],
  availability: readonly ProfileRecurringAvailability[]
): ProfileShiftPreference[] {
  if (preferences.length === 0) return [];
  return preferences.filter(
    (preference) => !profileShiftPreferenceFitsAvailability(preference, availability)
  );
}
