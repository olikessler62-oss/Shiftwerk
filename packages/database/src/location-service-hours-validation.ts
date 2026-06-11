import { normalizeTime } from "./utils";

export type ServiceHourInput = {
  weekday: number;
  start_time: string;
  end_time: string;
};

export type ServiceHourWindow = {
  start_time: string;
  end_time: string;
};

function normalizeTimeField(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 5) return trimmed.slice(0, 5);
  return trimmed;
}

export function parseServiceHourTimeToMinutes(value: string): number | null {
  const trimmed = normalizeTimeField(value);
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return null;
  const [h, m] = trimmed.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Kanonisches HH:MM — unabhängig von führenden Nullen oder Sekunden. */
export function normalizeServiceHourTimeComparable(value: string): string {
  const minutes = parseServiceHourTimeToMinutes(value);
  if (minutes == null) return normalizeTimeField(value);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function serviceHoursSameWindow(
  a: Pick<ServiceHourInput, "weekday" | "start_time" | "end_time">,
  b: Pick<ServiceHourInput, "weekday" | "start_time" | "end_time">
): boolean {
  if (a.weekday !== b.weekday) return false;
  return (
    normalizeServiceHourTimeComparable(a.start_time) ===
      normalizeServiceHourTimeComparable(b.start_time) &&
    normalizeServiceHourTimeComparable(a.end_time) ===
      normalizeServiceHourTimeComparable(b.end_time)
  );
}

export function serviceHourIntervalsOverlap(
  a: ServiceHourInput,
  b: ServiceHourInput
): boolean {
  const aStart = parseServiceHourTimeToMinutes(a.start_time);
  const aEnd = parseServiceHourTimeToMinutes(a.end_time);
  const bStart = parseServiceHourTimeToMinutes(b.start_time);
  const bEnd = parseServiceHourTimeToMinutes(b.end_time);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) {
    return false;
  }
  return aStart < bEnd && bStart < aEnd;
}

export function validateServiceHoursInput(
  rows: ServiceHourInput[]
): { ok: true; data: ServiceHourInput[] } | { ok: false; error: string } {
  const normalized: ServiceHourInput[] = [];
  const byWeekday = new Map<number, ServiceHourInput[]>();

  for (const row of rows) {
    if (!Number.isInteger(row.weekday) || row.weekday < 0 || row.weekday > 7) {
      return { ok: false, error: "Ungültiger Wochentag." };
    }

    const startMin = parseServiceHourTimeToMinutes(row.start_time);
    const endMin = parseServiceHourTimeToMinutes(row.end_time);
    if (startMin == null || endMin == null) {
      return { ok: false, error: "Bitte gültige Uhrzeiten eingeben (HH:MM)." };
    }
    if (endMin <= startMin) {
      return { ok: false, error: "„Uhrzeit bis“ muss nach „Uhrzeit von“ liegen." };
    }

    const normalizedRow: ServiceHourInput = {
      weekday: row.weekday,
      start_time: normalizeTime(row.start_time),
      end_time: normalizeTime(row.end_time),
    };
    normalized.push(normalizedRow);

    const weekdayRows = byWeekday.get(row.weekday) ?? [];
    weekdayRows.push(normalizedRow);
    byWeekday.set(row.weekday, weekdayRows);
  }

  for (const weekdayRows of byWeekday.values()) {
    for (let i = 0; i < weekdayRows.length; i++) {
      for (let j = i + 1; j < weekdayRows.length; j++) {
        if (serviceHourIntervalsOverlap(weekdayRows[i]!, weekdayRows[j]!)) {
          return {
            ok: false,
            error: "Zeitfenster am selben Tag dürfen sich nicht überlappen.",
          };
        }
      }
    }
  }

  normalized.sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return a.start_time.localeCompare(b.start_time);
  });

  return { ok: true, data: normalized };
}

export function shiftTimesWithinServiceHours(
  startTime: string,
  endTime: string,
  windows: ServiceHourWindow[]
): boolean {
  const startMin = parseServiceHourTimeToMinutes(startTime);
  const endMin = parseServiceHourTimeToMinutes(endTime);
  if (startMin == null || endMin == null) return false;
  if (endMin <= startMin) return false;
  if (windows.length === 0) return false;

  return windows.some((window) => {
    const windowStart = parseServiceHourTimeToMinutes(window.start_time);
    const windowEnd = parseServiceHourTimeToMinutes(window.end_time);
    if (windowStart == null || windowEnd == null) return false;
    return startMin >= windowStart && endMin <= windowEnd;
  });
}

export const SHIFT_OUTSIDE_SERVICE_HOURS_ERROR =
  "Schicht liegt außerhalb der Servicezeiten.";

export const NO_SERVICE_HOURS_FOR_DAY_ERROR =
  "Keine Servicezeiten für diesen Tag hinterlegt.";

export function validateShiftAgainstServiceHours(
  serviceHours: {
    location_area_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
  }[],
  areaId: string,
  weekday: number,
  startTime: string,
  endTime: string
): { ok: true } | { ok: false; error: string } {
  const windows = serviceHours
    .filter(
      (hour) =>
        hour.location_area_id === areaId &&
        hour.weekday === weekday &&
        hour.start_time &&
        hour.end_time
    )
    .map((hour) => ({
      start_time: hour.start_time,
      end_time: hour.end_time,
    }))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  if (windows.length === 0) {
    return { ok: false, error: NO_SERVICE_HOURS_FOR_DAY_ERROR };
  }

  if (!shiftTimesWithinServiceHours(startTime, endTime, windows)) {
    return { ok: false, error: SHIFT_OUTSIDE_SERVICE_HOURS_ERROR };
  }

  return { ok: true };
}
