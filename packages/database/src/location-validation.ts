import type { Location } from "@schichtwerk/types";
import { validateActiveWeekdaysField } from "./location-weekdays";

export type LocationUniquenessInput = {
  name: string;
  excludeId?: string;
};

export const MAX_LOCATION_NAME_LENGTH = 25;

export type LocationInput = {
  name: string;
  active_weekdays: string;
  on_holiday_open: boolean;
};

function normalizeNameKey(name: string): string {
  return name.trim().toLocaleLowerCase("de-DE");
}

export function validateLocationUniqueness(
  existing: Pick<Location, "id" | "name">[],
  input: LocationUniquenessInput
): { ok: true } | { ok: false; error: string } {
  const nameKey = normalizeNameKey(input.name);
  const others = input.excludeId
    ? existing.filter((l) => l.id !== input.excludeId)
    : existing;

  if (others.some((l) => normalizeNameKey(l.name) === nameKey)) {
    return {
      ok: false,
      error: "Ein Standort mit diesem Namen existiert bereits.",
    };
  }

  return { ok: true };
}

export function validateLocationInput(
  input: LocationInput
): { ok: true; data: LocationInput } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Bitte einen Standortnamen eingeben." };
  }
  if (name.length > MAX_LOCATION_NAME_LENGTH) {
    return {
      ok: false,
      error: `Der Standortname darf höchstens ${MAX_LOCATION_NAME_LENGTH} Zeichen haben.`,
    };
  }

  const weekdays = validateActiveWeekdaysField(input.active_weekdays);
  if (!weekdays.ok) return weekdays;

  return {
    ok: true,
    data: {
      name,
      active_weekdays: weekdays.value,
      on_holiday_open: Boolean(input.on_holiday_open),
    },
  };
}
