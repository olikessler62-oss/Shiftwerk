const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function timeToMinutes(raw: string): number {
  const value = raw.trim().slice(0, 5);
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function normalizeTimeValue(raw: string): string {
  const trimmed = raw.trim();
  if (!TIME_RE.test(trimmed)) {
    throw new Error("INVALID_TIME");
  }
  return `${trimmed}:00`;
}

export function parseAvailabilityWeekday(
  raw: number
): { ok: true; weekday: number } | { ok: false; error: string } {
  if (!Number.isInteger(raw) || raw < 0 || raw > 6) {
    return { ok: false, error: "Bitte einen gültigen Wochentag wählen." };
  }
  return { ok: true, weekday: raw };
}

export function parseAvailabilityTimeRange(input: {
  start_time: string;
  end_time: string;
}):
  | { ok: true; start_time: string; end_time: string }
  | { ok: false; error: string } {
  try {
    const start_time = normalizeTimeValue(input.start_time);
    const end_time = normalizeTimeValue(input.end_time);
    if (timeToMinutes(end_time) <= timeToMinutes(start_time)) {
      return { ok: false, error: "Die Endzeit muss nach der Startzeit liegen." };
    }
    return { ok: true, start_time, end_time };
  } catch {
    return { ok: false, error: "Bitte gültige Uhrzeiten eingeben." };
  }
}

export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const a0 = timeToMinutes(aStart);
  const a1 = timeToMinutes(aEnd);
  const b0 = timeToMinutes(bStart);
  const b1 = timeToMinutes(bEnd);
  return a0 < b1 && a1 > b0;
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
