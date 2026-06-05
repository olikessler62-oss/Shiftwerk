import type { ShiftType } from "@schichtwerk/types";
import { normalizeTime } from "./utils";

export type ShiftTypeUniquenessInput = {
  name: string;
  start_time: string;
  end_time: string;
  excludeId?: string;
};

function normalizeNameKey(name: string): string {
  return name.trim().toLocaleLowerCase("de-DE");
}

export function validateShiftTypeUniqueness(
  existing: Pick<ShiftType, "id" | "name" | "start_time" | "end_time">[],
  input: ShiftTypeUniquenessInput
): { ok: true } | { ok: false; error: string } {
  const nameKey = normalizeNameKey(input.name);
  const start = normalizeTime(input.start_time);
  const end = normalizeTime(input.end_time);

  const others = input.excludeId
    ? existing.filter((t) => t.id !== input.excludeId)
    : existing;

  if (others.some((t) => normalizeNameKey(t.name) === nameKey)) {
    return {
      ok: false,
      error: "Eine Schichtart mit dieser Bezeichnung existiert bereits.",
    };
  }

  const timeConflict = others.find(
    (t) =>
      normalizeTime(t.start_time) === start && normalizeTime(t.end_time) === end
  );
  if (timeConflict) {
    return {
      ok: false,
      error: `Eine Schichtart mit diesen Uhrzeiten existiert bereits („${timeConflict.name.trim()}“).`,
    };
  }

  return { ok: true };
}
