import type { ShiftTypeBreakInput } from "./interface";
import { timeToMinutes } from "./profile-availability-validation";
import {
  breakMinutesOnShiftTimelineSegment,
  shiftWindowMinutes,
} from "./shift-type-break-rules";

const MINUTES_PER_DAY = 24 * 60;

export type ShiftCalendarDaySegment = {
  dateISO: string;
  startTime: string;
  endTime: string;
  minutes: number;
};

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** end <= start auf dem Kalendertag = Schicht endet am Folgetag. */
export function isOvernightShiftWindow(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) <= timeToMinutes(startTime);
}

/** Folgetag einer Über-Nacht-Schicht (sonst shiftDate). */
export function overnightShiftEndDateISO(
  shiftDate: string,
  startTime: string,
  endTime: string
): string {
  if (!isOvernightShiftWindow(startTime, endTime)) return shiftDate;
  return addDaysISO(shiftDate, 1);
}

/**
 * Teilt eine Schicht an der lokalen Mitternacht (00:00) in Kalendertags-Segmente.
 * Grundlage für Tagesstunden, Footer-Kosten und spätere Sonderzulagen (Sonntag/Feiertag).
 */
export function splitShiftWindowIntoCalendarDaySegments(input: {
  shiftDate: string;
  startTime: string;
  endTime: string;
}): ShiftCalendarDaySegment[] {
  const startMin = timeToMinutes(input.startTime);
  const endMin = timeToMinutes(input.endTime);
  if (startMin === endMin) return [];

  if (endMin > startMin) {
    return [
      {
        dateISO: input.shiftDate,
        startTime: formatClock(startMin),
        endTime: formatClock(endMin),
        minutes: endMin - startMin,
      },
    ];
  }

  return [
    {
      dateISO: input.shiftDate,
      startTime: formatClock(startMin),
      endTime: "24:00",
      minutes: MINUTES_PER_DAY - startMin,
    },
    {
      dateISO: addDaysISO(input.shiftDate, 1),
      startTime: "00:00",
      endTime: formatClock(endMin),
      minutes: endMin,
    },
  ];
}

function shiftTimelineSegmentBounds(
  shiftDate: string,
  startTime: string,
  endTime: string,
  segment: ShiftCalendarDaySegment
): { segmentStartM: number; segmentEndM: number } {
  const { startM, endM } = shiftWindowMinutes(startTime, endTime);
  if (!isOvernightShiftWindow(startTime, endTime)) {
    return { segmentStartM: startM, segmentEndM: endM };
  }
  if (segment.dateISO === shiftDate) {
    return { segmentStartM: startM, segmentEndM: MINUTES_PER_DAY };
  }
  return { segmentStartM: MINUTES_PER_DAY, segmentEndM: endM };
}

/**
 * Wie splitShiftWindowIntoCalendarDaySegments, aber Pausen werden pro Kalendertag abgezogen.
 */
export function splitShiftWindowIntoCalendarDayNetWorkSegments(input: {
  shiftDate: string;
  startTime: string;
  endTime: string;
  breaks?: readonly ShiftTypeBreakInput[];
}): ShiftCalendarDaySegment[] {
  const grossSegments = splitShiftWindowIntoCalendarDaySegments(input);
  if (!input.breaks?.length) return grossSegments;

  return grossSegments.map((segment) => {
    const { segmentStartM, segmentEndM } = shiftTimelineSegmentBounds(
      input.shiftDate,
      input.startTime,
      input.endTime,
      segment
    );
    const breakMinutes = breakMinutesOnShiftTimelineSegment(
      input.breaks!,
      input.startTime,
      input.endTime,
      segmentStartM,
      segmentEndM
    );
    return {
      ...segment,
      minutes: Math.max(0, segment.minutes - breakMinutes),
    };
  });
}

export function shiftMinutesOnCalendarDay(input: {
  shiftDate: string;
  startTime: string;
  endTime: string;
  calendarDate: string;
  breaks?: readonly ShiftTypeBreakInput[];
}): number {
  const segments = input.breaks?.length
    ? splitShiftWindowIntoCalendarDayNetWorkSegments(input)
    : splitShiftWindowIntoCalendarDaySegments(input);
  return segments
    .filter((segment) => segment.dateISO === input.calendarDate)
    .reduce((sum, segment) => sum + segment.minutes, 0);
}

export function shiftHoursOnCalendarDay(input: {
  shiftDate: string;
  startTime: string;
  endTime: string;
  calendarDate: string;
  breaks?: readonly ShiftTypeBreakInput[];
}): number {
  return Math.round((shiftMinutesOnCalendarDay(input) / 60) * 10) / 10;
}
