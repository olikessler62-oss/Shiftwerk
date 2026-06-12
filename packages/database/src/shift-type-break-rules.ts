import { normalizeTime } from "./utils";
import type { ShiftTypeBreakInput } from "./interface";
import {
  getBreakDurationRuleForCountry,
  validateShiftTypeBreaksForCountry,
  DEFAULT_COUNTRY_CODE,
} from "./labor-compliance-validation";

export const MAX_SHIFT_TYPES_PER_ORGANIZATION = 6;
export const MAX_AREA_SHIFT_TEMPLATES_PER_AREA = 6;

const MINUTES_PER_DAY = 24 * 60;

export function timeToMinutes(time: string): number {
  const normalized = normalizeTime(time).slice(0, 5);
  const [h, m] = normalized.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTimeInput(totalMinutes: number): string {
  const dayMinutes =
    ((Math.round(totalMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(dayMinutes / 60);
  const m = dayMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Schichtfenster auf einer Timeline (Ende kann > 24h sein bei Nachtschicht). */
export function shiftWindowMinutes(
  start_time: string,
  end_time: string
): { startM: number; endM: number } {
  const startM = timeToMinutes(start_time);
  let endM = timeToMinutes(end_time);
  if (endM <= startM) endM += MINUTES_PER_DAY;
  return { startM, endM };
}

export function shiftDurationMinutes(start_time: string, end_time: string): number {
  const { startM, endM } = shiftWindowMinutes(start_time, end_time);
  return endM - startM;
}

export function shiftDurationHours(start_time: string, end_time: string): number {
  return shiftDurationMinutes(start_time, end_time) / 60;
}

export type BreakDurationRule = {
  kind: "max" | "required" | "none";
  minutes: number;
  minSegmentMinutes?: number;
};

/** Pausenregeln nach Schichtdauer (Stunden) — abhängig vom Organisations-Land. */
export function getBreakDurationRule(
  start_time: string,
  end_time: string,
  countryCode: string | null = DEFAULT_COUNTRY_CODE
): BreakDurationRule {
  return getBreakDurationRuleForCountry(countryCode, start_time, end_time);
}

export function getSuggestedBreakMinutes(
  start_time: string,
  end_time: string,
  countryCode: string | null = DEFAULT_COUNTRY_CODE
): number {
  const rule = getBreakDurationRule(start_time, end_time, countryCode);
  return rule.kind === "none" ? 0 : rule.minutes;
}

/** Pause mittig in der Schicht, Dauer gemäß Vorgabe (begrenzt auf Schichtlänge). */
export function centeredBreakForShift(
  start_time: string,
  end_time: string,
  breakMinutes: number
): { break_start: string; break_end: string } {
  const { startM, endM } = shiftWindowMinutes(start_time, end_time);
  const shiftLen = endM - startM;
  const duration = Math.min(Math.max(1, breakMinutes), shiftLen);
  const mid = startM + shiftLen / 2;
  let breakStartM = mid - duration / 2;
  let breakEndM = mid + duration / 2;

  if (breakStartM < startM) {
    breakStartM = startM;
    breakEndM = startM + duration;
  }
  if (breakEndM > endM) {
    breakEndM = endM;
    breakStartM = endM - duration;
  }

  return {
    break_start: minutesToTimeInput(breakStartM),
    break_end: minutesToTimeInput(breakEndM),
  };
}

export function validateShiftTypeBreaks(
  start_time: string,
  end_time: string,
  breaks: ShiftTypeBreakInput[],
  countryCode: string | null = DEFAULT_COUNTRY_CODE
): { ok: true } | { ok: false; error: string } {
  return validateShiftTypeBreaksForCountry(
    countryCode,
    start_time,
    end_time,
    breaks
  );
}

export function validateShiftTypeCount(
  existingCount: number,
  isCreate: boolean
): { ok: true } | { ok: false; error: string } {
  if (isCreate && existingCount >= MAX_SHIFT_TYPES_PER_ORGANIZATION) {
    return {
      ok: false,
      error: `Es sind höchstens ${MAX_SHIFT_TYPES_PER_ORGANIZATION} verschiedene Schichtarten erlaubt.`,
    };
  }
  return { ok: true };
}

export function validateAreaShiftTemplateCount(
  existingCount: number,
  isCreate: boolean
): { ok: true } | { ok: false; error: string } {
  if (isCreate && existingCount >= MAX_AREA_SHIFT_TEMPLATES_PER_AREA) {
    return {
      ok: false,
      error: `Es sind höchstens ${MAX_AREA_SHIFT_TEMPLATES_PER_AREA} Schichtvorlagen pro Bereich erlaubt.`,
    };
  }
  return { ok: true };
}

export function breakRuleHint(
  start_time: string,
  end_time: string,
  countryCode: string | null = DEFAULT_COUNTRY_CODE
): string {
  const rule = getBreakDurationRule(start_time, end_time, countryCode);
  if (rule.kind === "none") {
    return "Keine gesetzliche Mindestpause für diese Schichtdauer.";
  }
  if (rule.kind === "max") {
    return `Pause max. ${rule.minutes} Min., mittig in der Schicht.`;
  }
  return `${rule.minutes} Min. Pause mittig in der Schicht erforderlich.`;
}
