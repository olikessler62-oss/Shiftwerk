import { isPublicHolidayForCountry } from "@schichtwerk/compliance";
import type { AreaServiceHourRef } from "./location-service-hours";
import {
  shiftTimesWithinServiceHours,
  validateShiftAgainstServiceHours,
} from "./location-service-hours-validation";
import { STAFFING_HOLIDAY_WEEKDAY, weekdayIndexFromDate } from "./location-staffing";

function normalizeWeekday(value: number | string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : -1;
}

export function serviceWeekdayForShiftDate(
  countryCode: string,
  isoDate: string
): number {
  if (isPublicHolidayForCountry(countryCode, isoDate)) {
    return STAFFING_HOLIDAY_WEEKDAY;
  }
  return weekdayIndexFromDate(isoDate);
}

export function findServiceHourIdForShift(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  weekday: number,
  startTime: string,
  endTime: string
): string | null {
  for (const hour of serviceHours) {
    if (
      hour.location_area_id !== areaId ||
      normalizeWeekday(hour.weekday) !== weekday ||
      !hour.id ||
      !hour.start_time ||
      !hour.end_time
    ) {
      continue;
    }
    const windows = [
      { start_time: hour.start_time, end_time: hour.end_time },
    ];
    if (shiftTimesWithinServiceHours(startTime, endTime, windows)) {
      return hour.id;
    }
  }
  return null;
}

export function validateShiftServiceHoursForArea(
  serviceHours: readonly AreaServiceHourRef[],
  areaId: string,
  countryCode: string,
  shiftDate: string,
  startTime: string,
  endTime: string
): { ok: true } | { ok: false; error: string } {
  const weekday = serviceWeekdayForShiftDate(countryCode, shiftDate);
  return validateShiftAgainstServiceHours(
    serviceHours.map((hour) => ({
      location_area_id: hour.location_area_id,
      weekday: hour.weekday,
      start_time: hour.start_time ?? "",
      end_time: hour.end_time ?? "",
    })),
    areaId,
    weekday,
    startTime,
    endTime
  );
}
