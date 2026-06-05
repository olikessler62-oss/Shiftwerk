import type { Qualification } from "@schichtwerk/types";

export type QualificationUniquenessInput = {
  name: string;
  excludeId?: string;
};

function normalizeNameKey(name: string): string {
  return name.trim().toLocaleLowerCase("de-DE");
}

export function validateQualificationUniqueness(
  existing: Pick<Qualification, "id" | "name">[],
  input: QualificationUniquenessInput
): { ok: true } | { ok: false; error: string } {
  const nameKey = normalizeNameKey(input.name);
  const others = input.excludeId
    ? existing.filter((q) => q.id !== input.excludeId)
    : existing;

  if (others.some((q) => normalizeNameKey(q.name) === nameKey)) {
    return {
      ok: false,
      error: "Eine Qualifikation mit dieser Bezeichnung existiert bereits.",
    };
  }

  return { ok: true };
}
