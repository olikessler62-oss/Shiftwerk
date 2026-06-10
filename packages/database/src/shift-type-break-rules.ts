import { normalizeTime } from "./utils";
import type { ShiftTypeBreakInput } from "./interface";

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
  kind: "max";
  minutes: number;
} | {
  kind: "required";
  minutes: number;
};

/** Pausenregeln nach Schichtdauer (Stunden). */
export function getBreakDurationRule(
  start_time: string,
  end_time: string
): BreakDurationRule {
  const hours = shiftDurationHours(start_time, end_time);
  if (hours <= 6) {
    return { kind: "max", minutes: 15 };
  }
  if (hours <= 9) {
    return { kind: "required", minutes: 30 };
  }
  return { kind: "required", minutes: 45 };
}

export function getSuggestedBreakMinutes(start_time: string, end_time: string): number {
  const rule = getBreakDurationRule(start_time, end_time);
  return rule.kind === "max" ? rule.minutes : rule.minutes;
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

function totalBreakMinutesOnTimeline(
  breaks: ShiftTypeBreakInput[],
  startM: number,
  endM: number
): number {
  let total = 0;
  for (const b of breaks) {
    const interval = breakIntervalOnShiftTimeline(b.break_start, b.break_end, startM, endM);
    if (!interval) continue;
    total += interval.end - interval.start;
  }
  return Math.round(total);
}

function breaksCenteredOnShift(
  breaks: ShiftTypeBreakInput[],
  startM: number,
  endM: number
): boolean {
  const midShift = (startM + endM) / 2;
  let weightedMid = 0;
  let total = 0;

  for (const b of breaks) {
    const interval = breakIntervalOnShiftTimeline(b.break_start, b.break_end, startM, endM);
    if (!interval) return false;
    const len = interval.end - interval.start;
    weightedMid += ((interval.start + interval.end) / 2) * len;
    total += len;
  }

  if (total <= 0) return true;
  return Math.abs(weightedMid / total - midShift) <= 2;
}

export function validateShiftTypeBreaks(
  start_time: string,
  end_time: string,
  breaks: ShiftTypeBreakInput[]
): { ok: true } | { ok: false; error: string } {
  const durationMin = shiftDurationMinutes(start_time, end_time);
  if (durationMin <= 0) {
    return { ok: false, error: "Uhrzeit bis muss nach Uhrzeit von liegen." };
  }

  const { startM, endM } = shiftWindowMinutes(start_time, end_time);
  const rule = getBreakDurationRule(start_time, end_time);
  const totalBreak = totalBreakMinutesOnTimeline(breaks, startM, endM);

  for (const b of breaks) {
    if (!breakIntervalOnShiftTimeline(b.break_start, b.break_end, startM, endM)) {
      return {
        ok: false,
        error:
          "Alle Pausen müssen innerhalb der Schichtzeit liegen (nicht z. B. mittags bei Spätschicht).",
      };
    }
  }

  if (rule.kind === "max") {
    if (totalBreak > rule.minutes) {
      return {
        ok: false,
        error: `Bei Schichten bis 6 Stunden darf die Gesamtpause höchstens ${rule.minutes} Minuten betragen.`,
      };
    }
    if (breaks.length > 0 && !breaksCenteredOnShift(breaks, startM, endM)) {
      return {
        ok: false,
        error: "Pausen sollen mittig in der Schichtzeit liegen.",
      };
    }
    return { ok: true };
  }

  if (breaks.length === 0 || totalBreak !== rule.minutes) {
    const range =
      rule.minutes === 30 ? "über 6 bis 9 Stunden" : "über 9 Stunden";
    return {
      ok: false,
      error: `Bei Schichten ${range} ist eine Gesamtpause von ${rule.minutes} Minuten erforderlich.`,
    };
  }

  if (!breaksCenteredOnShift(breaks, startM, endM)) {
    return {
      ok: false,
      error: "Die Pause muss mittig in der Schichtzeit liegen.",
    };
  }

  return { ok: true };
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

export function breakRuleHint(start_time: string, end_time: string): string {
  const rule = getBreakDurationRule(start_time, end_time);
  if (rule.kind === "max") {
    return `Schicht ≤ 6 Std.: Pause max. ${rule.minutes} Min., mittig in der Schicht.`;
  }
  return `Schicht ${rule.minutes === 30 ? "> 6 bis 9 Std." : "> 9 Std."}: ${rule.minutes} Min. Pause mittig in der Schicht.`;
}
