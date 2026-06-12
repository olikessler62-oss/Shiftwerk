import { normalizeTime } from "./utils";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MINUTES_PER_DAY = 24 * 60;

export const PROFILE_AVAILABILITY_EQUAL_TIMES_ERROR =
  "Start- und Endzeit dürfen nicht gleich sein.";

export function timeToMinutes(raw: string): number {
  const value = raw.trim().slice(0, 5);
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function normalizeTimeValue(raw: string): string {
  const trimmed = raw.trim();
  const parts = trimmed.split(":");
  if (parts.length < 2) {
    throw new Error("INVALID_TIME");
  }
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = (parts[1] ?? "00").padStart(2, "0").slice(0, 2);
  const normalized = `${h}:${m}`;
  if (!TIME_RE.test(normalized)) {
    throw new Error("INVALID_TIME");
  }
  return `${normalized}:00`;
}

/** end <= start auf dem Kalendertag = Zeitfenster endet am Folgetag (wie Schichtarten). */
export function isOvernightAvailability(
  start_time: string,
  end_time: string
): boolean {
  return timeToMinutes(end_time) <= timeToMinutes(start_time);
}

type TimeSegment = { start: number; end: number };

function availabilitySegments(start_time: string, end_time: string): TimeSegment[] {
  const startM = timeToMinutes(start_time);
  const endM = timeToMinutes(end_time);
  if (endM > startM) {
    return [{ start: startM, end: endM }];
  }
  if (endM < startM) {
    return [
      { start: startM, end: MINUTES_PER_DAY },
      { start: 0, end: endM },
    ];
  }
  return [];
}

function segmentsOverlap(a: TimeSegment[], b: TimeSegment[]): boolean {
  for (const segA of a) {
    for (const segB of b) {
      if (segA.start < segB.end && segA.end > segB.start) return true;
    }
  }
  return false;
}

export function parseAvailabilityWeekday(
  raw: number
): { ok: true; weekday: number } | { ok: false; error: string } {
  if (!Number.isInteger(raw) || raw < 0 || raw > 7) {
    return { ok: false, error: "Bitte einen gültigen Wochentag wählen." };
  }
  return { ok: true, weekday: raw };
}

export function parseAvailabilityTimeRange(input: {
  start_time: string;
  end_time: string;
}):
  | { ok: true; start_time: string; end_time: string; overnight: boolean }
  | { ok: false; error: string } {
  try {
    const start_time = normalizeTime(input.start_time);
    const end_time = normalizeTime(input.end_time);
    if (timeToMinutes(end_time) === timeToMinutes(start_time)) {
      return { ok: false, error: PROFILE_AVAILABILITY_EQUAL_TIMES_ERROR };
    }
    return {
      ok: true,
      start_time,
      end_time,
      overnight: isOvernightAvailability(start_time, end_time),
    };
  } catch {
    return { ok: false, error: "Bitte gültige Uhrzeiten eingeben." };
  }
}

function mapProfileAvailabilityTimeConstraintError(message: string): string | null {
  if (message.includes("profile_recurring_availability_time_check")) {
    return PROFILE_AVAILABILITY_EQUAL_TIMES_ERROR;
  }
  return null;
}

export function toProfileAvailabilitySaveError(error: unknown): string {
  if (error instanceof Error) {
    const mapped = mapProfileAvailabilityTimeConstraintError(error.message);
    if (mapped) return mapped;
    return error.message;
  }
  return "Speichern fehlgeschlagen";
}

export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return segmentsOverlap(
    availabilitySegments(aStart, aEnd),
    availabilitySegments(bStart, bEnd)
  );
}

export function validateNoOverlappingAvailability(
  weekday: number,
  start_time: string,
  end_time: string,
  existing: readonly {
    id: string;
    weekday: number;
    start_time: string;
    end_time: string;
  }[],
  excludeId?: string
): { ok: true } | { ok: false; error: string } {
  for (const slot of existing) {
    if (excludeId && slot.id === excludeId) continue;
    if (slot.weekday !== weekday) continue;
    if (timeRangesOverlap(start_time, end_time, slot.start_time, slot.end_time)) {
      return {
        ok: false,
        error: "Die Zeitspanne überschneidet sich mit einer bestehenden Verfügbarkeit.",
      };
    }
  }
  return { ok: true };
}

type ProfileRecurringAvailabilitySortable = {
  weekday: number;
  start_time: string;
  end_time: string;
  id?: string;
};

export function compareProfileRecurringAvailabilityBySchedule<
  T extends ProfileRecurringAvailabilitySortable,
>(a: T, b: T): number {
  if (a.weekday !== b.weekday) return a.weekday - b.weekday;
  const startCmp = a.start_time.localeCompare(b.start_time);
  if (startCmp !== 0) return startCmp;
  const endCmp = a.end_time.localeCompare(b.end_time);
  if (endCmp !== 0) return endCmp;
  return (a.id ?? "").localeCompare(b.id ?? "");
}

export function sortProfileRecurringAvailabilityBySchedule<
  T extends ProfileRecurringAvailabilitySortable,
>(items: readonly T[]): T[] {
  return [...items].sort(compareProfileRecurringAvailabilityBySchedule);
}
