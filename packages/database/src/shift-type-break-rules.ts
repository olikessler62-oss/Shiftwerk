import { normalizeTime } from "./utils";
import type { ShiftTypeBreakInput } from "./interface";
import {
  getBreakDurationRuleForCountry,
  validateShiftTypeBreaksForCountry,
  type ValidateShiftTypeBreaksOptions,
  DEFAULT_COUNTRY_CODE,
} from "./labor-compliance-validation";

export const MAX_SHIFT_TYPES_PER_ORGANIZATION = 6;
export const MAX_AREA_SHIFT_TEMPLATES_PER_AREA = 6;

/** Schichtvorlagen-Modal: Mittigkeitsprüfung der Pausen deaktiviert. */
export const AREA_SHIFT_TEMPLATE_BREAK_VALIDATION_OPTIONS = {
  enforceBreaksCenteredOnShift: false,
} as const;

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

function breakIntervalOnShiftTimeline(
  break_start: string,
  break_end: string,
  startM: number,
  endM: number
): { start: number; end: number } | null {
  let bs = timeToMinutes(break_start);
  let be = timeToMinutes(break_end);
  if (be <= bs) be += MINUTES_PER_DAY;

  for (const offset of [0, MINUTES_PER_DAY, -MINUTES_PER_DAY]) {
    const bStart = bs + offset;
    const bEnd = be + offset;
    if (bStart >= startM - 1 && bEnd <= endM + 1 && bEnd > bStart) {
      return { start: bStart, end: bEnd };
    }
  }
  return null;
}

/** Pausenminuten innerhalb eines Schichtfensters (nur überlappende Intervalle). */
export function totalBreakMinutesOnShiftTimeline(
  breaks: readonly ShiftTypeBreakInput[],
  start_time: string,
  end_time: string
): number {
  if (breaks.length === 0) return 0;
  const { startM, endM } = shiftWindowMinutes(start_time, end_time);
  let total = 0;
  for (const entry of breaks) {
    const interval = breakIntervalOnShiftTimeline(
      entry.break_start,
      entry.break_end,
      startM,
      endM
    );
    if (!interval) continue;
    total += interval.end - interval.start;
  }
  return Math.round(total);
}

/** Pausenminuten, die ein Kalendertags-Segment auf der Schicht-Timeline überlappen. */
export function breakMinutesOnShiftTimelineSegment(
  breaks: readonly ShiftTypeBreakInput[],
  shift_start_time: string,
  shift_end_time: string,
  segment_start_m: number,
  segment_end_m: number
): number {
  if (breaks.length === 0 || segment_end_m <= segment_start_m) return 0;
  const { startM, endM } = shiftWindowMinutes(shift_start_time, shift_end_time);
  let total = 0;
  for (const entry of breaks) {
    const interval = breakIntervalOnShiftTimeline(
      entry.break_start,
      entry.break_end,
      startM,
      endM
    );
    if (!interval) continue;
    const overlapStart = Math.max(interval.start, segment_start_m);
    const overlapEnd = Math.min(interval.end, segment_end_m);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return Math.round(total);
}

/** Brutto-Schichtdauer minus Pausen = Netto-Arbeitszeit. Ohne Pausen = Brutto. */
export function shiftNetWorkMinutes(
  start_time: string,
  end_time: string,
  breaks: readonly ShiftTypeBreakInput[] = []
): number {
  const gross = shiftDurationMinutes(start_time, end_time);
  if (breaks.length === 0) return gross;
  const breakMinutes = totalBreakMinutesOnShiftTimeline(breaks, start_time, end_time);
  return Math.max(0, gross - breakMinutes);
}

export function shiftNetWorkHours(
  start_time: string,
  end_time: string,
  breaks: readonly ShiftTypeBreakInput[] = []
): number {
  return Math.round((shiftNetWorkMinutes(start_time, end_time, breaks) / 60) * 10) / 10;
}

export function roundWorkHours(hours: number): number {
  return Math.round(hours * 10) / 10;
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
  countryCode: string | null = DEFAULT_COUNTRY_CODE,
  options?: ValidateShiftTypeBreaksOptions
): { ok: true } | { ok: false; error: string } {
  return validateShiftTypeBreaksForCountry(
    countryCode,
    start_time,
    end_time,
    breaks,
    options
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
