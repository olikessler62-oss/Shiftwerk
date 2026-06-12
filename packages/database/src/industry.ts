import type { Industry } from "@schichtwerk/types";

export type { Industry };

export const INDUSTRIES: readonly Industry[] = [
  "gastronomy",
  "care",
  "retail",
  "other",
];

export function isIndustry(value: unknown): value is Industry {
  return (
    value === "gastronomy" ||
    value === "care" ||
    value === "retail" ||
    value === "other"
  );
}

export function normalizeIndustry(value: unknown): Industry | null {
  return isIndustry(value) ? value : null;
}

export function validateIndustry(
  value: unknown
): { ok: true; value: Industry } | { ok: false; error: string } {
  if (!isIndustry(value)) {
    return { ok: false, error: "Ungültige Branche." };
  }
  return { ok: true, value };
}
