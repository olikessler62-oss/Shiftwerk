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
      error: "Eine Funktion mit dieser Bezeichnung existiert bereits.",
    };
  }

  return { ok: true };
}

export function validateQualificationArchive(upcomingShiftCount: number):
  | { ok: true }
  | { ok: false; error: string } {
  if (upcomingShiftCount > 0) {
    return {
      ok: false,
      error:
        "Mitarbeiter mit dieser Funktion sind noch in anstehenden Schichten eingeteilt. Weisen Sie diesen Mitarbeitern zuerst eine andere Funktion zu.",
    };
  }
  return { ok: true };
}
