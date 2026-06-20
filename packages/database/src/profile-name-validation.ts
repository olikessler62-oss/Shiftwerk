import type { Profile } from "@schichtwerk/types";

export type ProfileFullNameUniquenessInput = {
  full_name: string;
  excludeId?: string;
};

export const PROFILE_DUPLICATE_FULL_NAME_ERROR =
  "Mitarbeiternamen müssen sich unterscheiden – gegebenenfalls mit Abkürzung, Nickname statt Vorname oder Zahl mit Hochzählung ab dem zweiten gleichen Mitarbeiternamen.";

function normalizeProfileFullNameKey(name: string): string {
  return name.trim().toLocaleLowerCase("de-DE");
}

export function validateProfileFullNameUniqueness(
  existing: Pick<Profile, "id" | "full_name">[],
  input: ProfileFullNameUniquenessInput
): { ok: true } | { ok: false; error: string } {
  const nameKey = normalizeProfileFullNameKey(input.full_name);
  const others = input.excludeId
    ? existing.filter((profile) => profile.id !== input.excludeId)
    : existing;

  if (others.some((profile) => normalizeProfileFullNameKey(profile.full_name) === nameKey)) {
    return { ok: false, error: PROFILE_DUPLICATE_FULL_NAME_ERROR };
  }

  return { ok: true };
}
