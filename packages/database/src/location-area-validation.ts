import type { LocationArea } from "@schichtwerk/types";

export const MAX_LOCATION_AREA_NAME_LENGTH = 25;

export type LocationAreaUniquenessInput = {
  name: string;
  excludeId?: string;
};

function normalizeNameKey(name: string): string {
  return name.trim().toLocaleLowerCase("de-DE");
}

export function validateLocationAreaUniqueness(
  existing: Pick<LocationArea, "id" | "name">[],
  input: LocationAreaUniquenessInput
): { ok: true } | { ok: false; error: string } {
  const nameKey = normalizeNameKey(input.name);
  const others = input.excludeId
    ? existing.filter((a) => a.id !== input.excludeId)
    : existing;

  if (others.some((a) => normalizeNameKey(a.name) === nameKey)) {
    return {
      ok: false,
      error: "Ein Bereich mit dieser Bezeichnung existiert an diesem Standort bereits.",
    };
  }

  return { ok: true };
}

export function validateLocationAreaName(
  name: string
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Bitte eine Bezeichnung eingeben." };
  }
  if (trimmed.length > MAX_LOCATION_AREA_NAME_LENGTH) {
    return {
      ok: false,
      error: `Die Bezeichnung darf höchstens ${MAX_LOCATION_AREA_NAME_LENGTH} Zeichen haben.`,
    };
  }
  return { ok: true, value: trimmed };
}
