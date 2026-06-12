import { parseClockTimeToMinutes } from "@/lib/shift-card-time-gradient";
import {
  normalizeServiceHourWeekday,
  serviceWeekdayForDate,
  type AreaServiceHourRef,
} from "@/lib/location-staffing-client";

const MINUTES_PER_DAY = 24 * 60;

export type ShiftCardServiceTimeline = {
  startMin: number;
  endMin: number;
  durationMin: number;
  /** Keine Servicezeiten hinterlegt — Fallback 00:00–24:00. */
  usesFullDay: boolean;
};

function hourWindowToMinuteRange(
  startTime: string,
  endTime: string
): { startMin: number; endMin: number } | null {
  const startMin = parseClockTimeToMinutes(startTime);
  let endMin = parseClockTimeToMinutes(endTime);
  if (endMin <= startMin) {
    endMin += MINUTES_PER_DAY;
  }
  return { startMin, endMin };
}

function serviceHoursForAreaOnDate(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  dateISO: string
): AreaServiceHourRef[] {
  const weekday = serviceWeekdayForDate(dateISO);
  return serviceHours.filter(
    (hour) =>
      hour.location_area_id === areaId &&
      normalizeServiceHourWeekday(hour.weekday) === weekday &&
      hour.start_time?.trim() &&
      hour.end_time?.trim()
  );
}

/** Frühester Start bis spätestes Ende aller Servicezeit-Fenster = 100 % Zellenbreite. */
export function resolveAreaServiceDayTimeline(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  dateISO: string
): ShiftCardServiceTimeline {
  const hours = serviceHoursForAreaOnDate(serviceHours, areaId, dateISO);

  if (hours.length === 0) {
    return {
      startMin: 0,
      endMin: MINUTES_PER_DAY,
      durationMin: MINUTES_PER_DAY,
      usesFullDay: true,
    };
  }

  let startMin = Number.POSITIVE_INFINITY;
  let endMin = Number.NEGATIVE_INFINITY;

  for (const hour of hours) {
    const range = hourWindowToMinuteRange(hour.start_time!, hour.end_time!);
    if (!range) continue;
    startMin = Math.min(startMin, range.startMin);
    endMin = Math.max(endMin, range.endMin);
  }

  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
    return {
      startMin: 0,
      endMin: MINUTES_PER_DAY,
      durationMin: MINUTES_PER_DAY,
      usesFullDay: true,
    };
  }

  return {
    startMin,
    endMin,
    durationMin: endMin - startMin,
    usesFullDay: false,
  };
}

/** Standortweite Hülle aller Bereiche — für einfachen Planungsmodus ohne Bereichsspalten. */
export function resolveLocationServiceDayTimeline(
  serviceHours: readonly AreaServiceHourRef[],
  dateISO: string
): ShiftCardServiceTimeline {
  const weekday = serviceWeekdayForDate(dateISO);
  const hours = serviceHours.filter(
    (hour) =>
      normalizeServiceHourWeekday(hour.weekday) === weekday &&
      hour.start_time?.trim() &&
      hour.end_time?.trim()
  );

  if (hours.length === 0) {
    return {
      startMin: 0,
      endMin: MINUTES_PER_DAY,
      durationMin: MINUTES_PER_DAY,
      usesFullDay: true,
    };
  }

  let startMin = Number.POSITIVE_INFINITY;
  let endMin = Number.NEGATIVE_INFINITY;

  for (const hour of hours) {
    const range = hourWindowToMinuteRange(hour.start_time!, hour.end_time!);
    if (!range) continue;
    startMin = Math.min(startMin, range.startMin);
    endMin = Math.max(endMin, range.endMin);
  }

  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
    return {
      startMin: 0,
      endMin: MINUTES_PER_DAY,
      durationMin: MINUTES_PER_DAY,
      usesFullDay: true,
    };
  }

  return {
    startMin,
    endMin,
    durationMin: endMin - startMin,
    usesFullDay: false,
  };
}

function shiftMinuteOnTimeline(
  time: string,
  timeline: ShiftCardServiceTimeline
): number {
  let minutes = parseClockTimeToMinutes(time);
  if (timeline.endMin > MINUTES_PER_DAY && minutes < timeline.startMin) {
    minutes += MINUTES_PER_DAY;
  }
  return minutes;
}

function resolveShiftOnTimeline(
  startTime: string,
  endTime: string,
  timeline: ShiftCardServiceTimeline
): { startMin: number; endMin: number; durationMin: number } {
  let startMin = shiftMinuteOnTimeline(startTime, timeline);
  let endMin = shiftMinuteOnTimeline(endTime, timeline);
  if (endMin <= startMin) {
    endMin += MINUTES_PER_DAY;
  }
  return { startMin, endMin, durationMin: endMin - startMin };
}

export function timelineLeftPx(
  startTime: string,
  trackWidthPx: number,
  timeline: ShiftCardServiceTimeline,
  cellPaddingPx = 4
): number {
  const { startMin } = resolveShiftOnTimeline(startTime, startTime, timeline);
  const offsetMin = startMin - timeline.startMin;
  const fraction = clamp01(offsetMin / timeline.durationMin);
  return cellPaddingPx + fraction * trackWidthPx;
}

export function timelineDurationWidthPx(
  startTime: string,
  endTime: string,
  trackWidthPx: number,
  timeline: ShiftCardServiceTimeline
): number {
  const { durationMin } = resolveShiftOnTimeline(startTime, endTime, timeline);
  return (durationMin / timeline.durationMin) * trackWidthPx;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export const SERVICE_TIMELINE_FULL_DAY_HOUR_COUNT = 24;

/** Stunden-Segmente für das Hintergrund-Raster (1 Linie pro Stunde auf der Timeline). */
export function serviceTimelineHourSegmentCount(
  timeline: ShiftCardServiceTimeline
): number {
  if (timeline.usesFullDay || timeline.durationMin <= 0) {
    return SERVICE_TIMELINE_FULL_DAY_HOUR_COUNT;
  }
  return Math.max(1, Math.ceil(timeline.durationMin / 60));
}

export function createServiceTimelineHourGridStyle(
  timeline: ShiftCardServiceTimeline,
  lineOpacityPercent: number
): { backgroundImage: string } {
  const lineColor = `color-mix(in srgb, var(--color-border) ${lineOpacityPercent}%, transparent)`;
  const hourCount = serviceTimelineHourSegmentCount(timeline);
  return {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(100% / ${hourCount} - 1px), ${lineColor} calc(100% / ${hourCount} - 1px), ${lineColor} calc(100% / ${hourCount}))`,
  };
}

export function createPastServiceTimelineHourGridStyle(
  timeline: ShiftCardServiceTimeline,
  lineColor = "#eef2f6"
): { backgroundImage: string } {
  const hourCount = serviceTimelineHourSegmentCount(timeline);
  const stops: string[] = ["transparent 0"];
  for (let hour = 1; hour < hourCount; hour += 1) {
    const pos = `calc(100% * ${hour} / ${hourCount})`;
    stops.push(`transparent calc(${pos} - 1px)`);
    stops.push(`${lineColor} calc(${pos} - 1px)`);
    stops.push(`${lineColor} ${pos}`);
  }
  return {
    backgroundImage: `linear-gradient(to right, ${stops.join(", ")})`,
  };
}
