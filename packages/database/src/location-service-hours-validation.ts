import { STAFFING_HOLIDAY_WEEKDAY } from "./location-staffing";
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

const MINUTES_PER_DAY = 24 * 60;

export const SERVICE_HOUR_EQUAL_TIMES_ERROR =
  "Start- und Endzeit dürfen nicht gleich sein.";

type TimeSegment = { start: number; end: number };

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

/** end <= start auf dem Kalendertag = Zeitfenster endet am Folgetag (wie Verfügbarkeiten). */
export function isOvernightServiceHour(
  start_time: string,
  end_time: string
): boolean {
  const startMin = parseServiceHourTimeToMinutes(start_time);
  const endMin = parseServiceHourTimeToMinutes(end_time);
  if (startMin == null || endMin == null) return false;
  return endMin <= startMin;
}

export function serviceHourTimeSegments(
  start_time: string,
  end_time: string
): TimeSegment[] {
  const startMin = parseServiceHourTimeToMinutes(start_time);
  const endMin = parseServiceHourTimeToMinutes(end_time);
  if (startMin == null || endMin == null || startMin === endMin) return [];
  if (endMin > startMin) {
    return [{ start: startMin, end: endMin }];
  }
  return [
    { start: startMin, end: MINUTES_PER_DAY },
    { start: 0, end: endMin },
  ];
}

/** Kalendertag des weekday-Eintrags — bei Über-Nacht nur der Abendanteil. */
function serviceHourSameDaySegments(
  start_time: string,
  end_time: string
): TimeSegment[] {
  const startMin = parseServiceHourTimeToMinutes(start_time);
  const endMin = parseServiceHourTimeToMinutes(end_time);
  if (startMin == null || endMin == null || startMin === endMin) return [];
  if (endMin > startMin) {
    return [{ start: startMin, end: endMin }];
  }
  return [{ start: startMin, end: MINUTES_PER_DAY }];
}

function segmentsOverlap(a: TimeSegment[], b: TimeSegment[]): boolean {
  for (const segA of a) {
    for (const segB of b) {
      if (segA.start < segB.end && segA.end > segB.start) return true;
    }
  }
  return false;
}

export function serviceHourNextWeekday(weekday: number): number {
  if (weekday >= 0 && weekday <= 6) return weekday === 6 ? 0 : weekday + 1;
  if (weekday === STAFFING_HOLIDAY_WEEKDAY) return 0;
  return weekday;
}

export function serviceHourPreviousWeekday(weekday: number): number {
  if (weekday >= 0 && weekday <= 6) return weekday === 0 ? 6 : weekday - 1;
  if (weekday === STAFFING_HOLIDAY_WEEKDAY) return 6;
  return weekday;
}

function normalizeServiceHourWeekday(value: number | string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : -1;
}

/** Morgenanteil einer Über-Nacht-Servicezeit (00:00–Ende) am Folgetag. */
export function overnightMorningSpillServiceWindows(
  end_time: string
): ServiceHourWindow[] {
  const endMin = parseServiceHourTimeToMinutes(end_time);
  if (endMin == null || endMin === 0) return [];
  return [
    {
      start_time: "00:00",
      end_time: normalizeServiceHourTimeComparable(end_time),
    },
  ];
}

/** Servicezeit-Fenster für Schichtvalidierung inkl. Über-Nacht-Spill vom Vortag. */
export function collectServiceHourWindowsForAreaShiftDay(
  serviceHours: readonly {
    location_area_id: string;
    weekday: number | string;
    start_time: string;
    end_time: string;
  }[],
  areaId: string,
  weekday: number
): ServiceHourWindow[] {
  const sameDay = serviceHours
    .filter(
      (hour) =>
        hour.location_area_id === areaId &&
        normalizeServiceHourWeekday(hour.weekday) === weekday &&
        hour.start_time &&
        hour.end_time
    )
    .map((hour) => ({
      start_time: hour.start_time,
      end_time: hour.end_time,
    }));

  const previousWeekday = serviceHourPreviousWeekday(weekday);
  const spill = serviceHours
    .filter(
      (hour) =>
        hour.location_area_id === areaId &&
        normalizeServiceHourWeekday(hour.weekday) === previousWeekday &&
        hour.start_time &&
        hour.end_time &&
        isOvernightServiceHour(hour.start_time, hour.end_time)
    )
    .flatMap((hour) => overnightMorningSpillServiceWindows(hour.end_time));

  return [...spill, ...sameDay].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );
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
  if (a.weekday !== b.weekday) return false;
  return segmentsOverlap(
    serviceHourSameDaySegments(a.start_time, a.end_time),
    serviceHourSameDaySegments(b.start_time, b.end_time)
  );
}

function overnightMorningSpillSegments(
  row: ServiceHourInput
): TimeSegment[] | null {
  if (!isOvernightServiceHour(row.start_time, row.end_time)) return null;
  const endMin = parseServiceHourTimeToMinutes(row.end_time);
  if (endMin == null || endMin === 0) return null;
  return [{ start: 0, end: endMin }];
}

function serviceHourRowsOverlap(a: ServiceHourInput, b: ServiceHourInput): boolean {
  if (serviceHourIntervalsOverlap(a, b)) return true;

  const aSpill = overnightMorningSpillSegments(a);
  if (
    aSpill &&
    b.weekday === serviceHourNextWeekday(a.weekday) &&
    segmentsOverlap(
      aSpill,
      serviceHourSameDaySegments(b.start_time, b.end_time)
    )
  ) {
    return true;
  }

  const bSpill = overnightMorningSpillSegments(b);
  if (
    bSpill &&
    a.weekday === serviceHourNextWeekday(b.weekday) &&
    segmentsOverlap(
      bSpill,
      serviceHourSameDaySegments(a.start_time, a.end_time)
    )
  ) {
    return true;
  }

  return false;
}

export function validateServiceHoursInput(
  rows: ServiceHourInput[]
): { ok: true; data: ServiceHourInput[] } | { ok: false; error: string } {
  const normalized: ServiceHourInput[] = [];

  for (const row of rows) {
    if (!Number.isInteger(row.weekday) || row.weekday < 0 || row.weekday > 7) {
      return { ok: false, error: "Ungültiger Wochentag." };
    }

    const startMin = parseServiceHourTimeToMinutes(row.start_time);
    const endMin = parseServiceHourTimeToMinutes(row.end_time);
    if (startMin == null || endMin == null) {
      return { ok: false, error: "Bitte gültige Uhrzeiten eingeben (HH:MM)." };
    }
    if (startMin === endMin) {
      return { ok: false, error: SERVICE_HOUR_EQUAL_TIMES_ERROR };
    }

    const normalizedRow: ServiceHourInput = {
      weekday: row.weekday,
      start_time: normalizeTime(row.start_time),
      end_time: normalizeTime(row.end_time),
    };
    normalized.push(normalizedRow);
  }

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (serviceHourRowsOverlap(normalized[i]!, normalized[j]!)) {
        return {
          ok: false,
          error: "Zeitfenster dürfen sich nicht überlappen.",
        };
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
  const shiftSegments = serviceHourTimeSegments(startTime, endTime);
  if (shiftSegments.length === 0) return false;
  if (windows.length === 0) return false;

  return windows.some((window) => {
    const windowSegments = serviceHourTimeSegments(
      window.start_time,
      window.end_time
    );
    if (windowSegments.length === 0) return false;
    return shiftSegments.every((shiftSegment) =>
      windowSegments.some(
        (windowSegment) =>
          shiftSegment.start >= windowSegment.start &&
          shiftSegment.end <= windowSegment.end
      )
    );
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
  const windows = collectServiceHourWindowsForAreaShiftDay(
    serviceHours,
    areaId,
    weekday
  );

  if (windows.length === 0) {
    return { ok: false, error: NO_SERVICE_HOURS_FOR_DAY_ERROR };
  }

  if (!shiftTimesWithinServiceHours(startTime, endTime, windows)) {
    return { ok: false, error: SHIFT_OUTSIDE_SERVICE_HOURS_ERROR };
  }

  return { ok: true };
}

export function mapServiceHoursTimeConstraintError(message: string): string | null {
  if (message.includes("location_area_service_hours_time_order")) {
    return SERVICE_HOUR_EQUAL_TIMES_ERROR;
  }
  return null;
}
