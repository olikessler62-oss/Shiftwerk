import { normalizeTime } from "./utils";

export type ServiceHourInput = {
  weekday: number;
  start_time: string;
  end_time: string;
};

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return null;
  const [h, m] = trimmed.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function validateServiceHoursInput(
  rows: ServiceHourInput[]
): { ok: true; data: ServiceHourInput[] } | { ok: false; error: string } {
  const seen = new Set<number>();
  const normalized: ServiceHourInput[] = [];

  for (const row of rows) {
    if (!Number.isInteger(row.weekday) || row.weekday < 0 || row.weekday > 7) {
      return { ok: false, error: "Ungültiger Wochentag." };
    }
    if (seen.has(row.weekday)) {
      return { ok: false, error: "Jeder Tag darf nur einmal vorkommen." };
    }
    seen.add(row.weekday);

    const startMin = parseTimeToMinutes(row.start_time);
    const endMin = parseTimeToMinutes(row.end_time);
    if (startMin == null || endMin == null) {
      return { ok: false, error: "Bitte gültige Uhrzeiten eingeben (HH:MM)." };
    }
    if (endMin <= startMin) {
      return { ok: false, error: "„Uhrzeit bis“ muss nach „Uhrzeit von“ liegen." };
    }

    normalized.push({
      weekday: row.weekday,
      start_time: normalizeTime(row.start_time),
      end_time: normalizeTime(row.end_time),
    });
  }

  return { ok: true, data: normalized };
}
