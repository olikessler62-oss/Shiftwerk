import { parseClockTimeToMinutes } from "@/lib/shift-card-time-gradient";
import {
  normalizeServiceHourWeekday,
  serviceWeekdayForDate,
  type AreaServiceHourRef,
} from "@/lib/location-staffing-client";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";

const MINUTES_PER_DAY = 24 * 60;

/** Bereich-Kalender-Zelleinteilung: Ende eines in den Folgetag reichenden Servicezeit-Eintrags. */
export const DASHBOARD_CELL_DIVISION_DAY_END_MIN = 23 * 60 + 59;

function isOvernightServiceHourEntry(startTime: string, endTime: string): boolean {
  return parseClockTimeToMinutes(endTime) <= parseClockTimeToMinutes(startTime);
}

function serviceHourEndMinForAreaCalendarCellDivision(
  startTime: string,
  endTime: string
): number {
  if (isOvernightServiceHourEntry(startTime, endTime)) {
    return DASHBOARD_CELL_DIVISION_DAY_END_MIN;
  }
  return parseClockTimeToMinutes(endTime);
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

function serviceHoursForLocationOnDate(
  serviceHours: readonly AreaServiceHourRef[],
  dateISO: string
): AreaServiceHourRef[] {
  const weekday = serviceWeekdayForDate(dateISO);
  return serviceHours.filter(
    (hour) =>
      normalizeServiceHourWeekday(hour.weekday) === weekday &&
      hour.start_time?.trim() &&
      hour.end_time?.trim()
  );
}

function earliestServiceStartMin(
  hours: readonly AreaServiceHourRef[]
): number | null {
  let earliestStart = Number.POSITIVE_INFINITY;
  for (const hour of hours) {
    earliestStart = Math.min(
      earliestStart,
      parseClockTimeToMinutes(hour.start_time!)
    );
  }
  return Number.isFinite(earliestStart) ? earliestStart : null;
}

function latestServiceEndMinForAreaCalendarCellDivision(
  hours: readonly AreaServiceHourRef[]
): number | null {
  let latestEnd = Number.NEGATIVE_INFINITY;
  for (const hour of hours) {
    latestEnd = Math.max(
      latestEnd,
      serviceHourEndMinForAreaCalendarCellDivision(
        hour.start_time!,
        hour.end_time!
      )
    );
  }
  return Number.isFinite(latestEnd) ? latestEnd : null;
}

function buildAreaCalendarTimelineFromHours(
  hours: readonly AreaServiceHourRef[]
): ShiftCardServiceTimeline {
  if (hours.length === 0) {
    return {
      startMin: 0,
      endMin: MINUTES_PER_DAY,
      durationMin: MINUTES_PER_DAY,
      usesFullDay: true,
    };
  }

  const earliestStart = earliestServiceStartMin(hours);
  const latestEnd = latestServiceEndMinForAreaCalendarCellDivision(hours);

  if (
    earliestStart === null ||
    latestEnd === null ||
    latestEnd <= earliestStart
  ) {
    return {
      startMin: 0,
      endMin: MINUTES_PER_DAY,
      durationMin: MINUTES_PER_DAY,
      usesFullDay: true,
    };
  }

  return {
    startMin: earliestStart,
    endMin: latestEnd,
    durationMin: latestEnd - earliestStart,
    usesFullDay: false,
  };
}

/**
 * Bereich-Kalender: Zell-Timeline nur aus Servicezeiten dieses Tages.
 * Über-Mitternacht-Einträge enden für die Einteilung um 23:59.
 */
export function resolveAreaCalendarAreaServiceDayTimeline(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  dateISO: string
): ShiftCardServiceTimeline {
  return buildAreaCalendarTimelineFromHours(
    serviceHoursForAreaOnDate(serviceHours, areaId, dateISO)
  );
}

/** Standort-Hülle für einfachen Planungsmodus / Stundenraster. */
export function resolveAreaCalendarLocationServiceDayTimeline(
  serviceHours: readonly AreaServiceHourRef[],
  dateISO: string
): ShiftCardServiceTimeline {
  return buildAreaCalendarTimelineFromHours(
    serviceHoursForLocationOnDate(serviceHours, dateISO)
  );
}

/** Starttag: frühester Servicebeginn bis 23:59 (Breiten-Kompromiss Overnight-Karte). */
export function areaCalendarStartDayServiceSpanMinutesForOvernightWidth(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  dateISO: string
): number {
  const hours = serviceHoursForAreaOnDate(serviceHours, areaId, dateISO);
  const earliestStart = earliestServiceStartMin(hours);
  if (earliestStart === null) return MINUTES_PER_DAY;
  return Math.max(1, DASHBOARD_CELL_DIVISION_DAY_END_MIN - earliestStart);
}

export function areaCalendarStartDayServiceSpanMinutesForOvernightWidthLocation(
  serviceHours: readonly AreaServiceHourRef[],
  dateISO: string
): number {
  const hours = serviceHoursForLocationOnDate(serviceHours, dateISO);
  const earliestStart = earliestServiceStartMin(hours);
  if (earliestStart === null) return MINUTES_PER_DAY;
  return Math.max(1, DASHBOARD_CELL_DIVISION_DAY_END_MIN - earliestStart);
}

/** Folgetag: frühester Beginn bis spätestes Ende — nur same-day-Einträge (22–04 zählt nicht). */
export function areaCalendarEndDayServiceSpanMinutesForOvernightWidth(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  dateISO: string
): number {
  const hours = serviceHoursForAreaOnDate(serviceHours, areaId, dateISO);
  const sameDayHours = hours.filter(
    (hour) =>
      !isOvernightServiceHourEntry(hour.start_time!, hour.end_time!)
  );

  const relevantHours = sameDayHours.length > 0 ? sameDayHours : hours;
  const earliestStart = earliestServiceStartMin(relevantHours);
  const latestEnd = latestServiceEndMinForAreaCalendarCellDivision(relevantHours);

  if (earliestStart === null || latestEnd === null) return MINUTES_PER_DAY;
  return Math.max(1, latestEnd - earliestStart);
}

export function areaCalendarEndDayServiceSpanMinutesForOvernightWidthLocation(
  serviceHours: readonly AreaServiceHourRef[],
  dateISO: string
): number {
  const hours = serviceHoursForLocationOnDate(serviceHours, dateISO);
  const sameDayHours = hours.filter(
    (hour) =>
      !isOvernightServiceHourEntry(hour.start_time!, hour.end_time!)
  );

  const relevantHours = sameDayHours.length > 0 ? sameDayHours : hours;
  const earliestStart = earliestServiceStartMin(relevantHours);
  const latestEnd = latestServiceEndMinForAreaCalendarCellDivision(relevantHours);

  if (earliestStart === null || latestEnd === null) return MINUTES_PER_DAY;
  return Math.max(1, latestEnd - earliestStart);
}

/**
 * Folgetag für Overnight-Span-Breite: 00:00 bis spätestes same-day Serviceende.
 * Der morgendliche Schichtanteil (00:00–Endzeit) wird auf diese Timeline skaliert.
 */
export function resolveAreaCalendarOvernightEndDayTimeline(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  dateISO: string
): ShiftCardServiceTimeline {
  const hours = areaId
    ? serviceHoursForAreaOnDate(serviceHours, areaId, dateISO)
    : serviceHoursForLocationOnDate(serviceHours, dateISO);
  const sameDayHours = hours.filter(
    (hour) =>
      !isOvernightServiceHourEntry(hour.start_time!, hour.end_time!)
  );
  const relevantHours = sameDayHours.length > 0 ? sameDayHours : hours;
  const latestEnd = latestServiceEndMinForAreaCalendarCellDivision(relevantHours);

  if (latestEnd === null || latestEnd <= 0) {
    return {
      startMin: 0,
      endMin: MINUTES_PER_DAY,
      durationMin: MINUTES_PER_DAY,
      usesFullDay: true,
    };
  }

  return {
    startMin: 0,
    endMin: latestEnd,
    durationMin: latestEnd,
    usesFullDay: false,
  };
}

export function areaCalendarOvernightShiftDurationMinutes(
  startTime: string,
  endTime: string
): number {
  const startMin = parseClockTimeToMinutes(startTime);
  let endMin = parseClockTimeToMinutes(endTime);
  if (endMin <= startMin) {
    endMin += MINUTES_PER_DAY;
  }
  return endMin - startMin;
}
