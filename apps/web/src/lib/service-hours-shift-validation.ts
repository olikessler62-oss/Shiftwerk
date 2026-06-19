import {
  serviceWeekdayForShiftDate as serviceWeekdayForShiftDateByCountry,
  validateShiftServiceHoursForArea,
} from "@schichtwerk/database";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";

export function serviceWeekdayForShiftDateFromCountry(
  countryCode: string,
  isoDate: string
): number {
  return serviceWeekdayForShiftDateByCountry(countryCode, isoDate);
}

/** @deprecated Use serviceWeekdayForShiftDateFromCountry with country code */
export function serviceWeekdayForShiftDate(isoDate: string): number {
  return serviceWeekdayForShiftDateByCountry("DE", isoDate);
}

export function validateAreaCalendarShiftServiceHours(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  shiftDate: string,
  startTime: string,
  endTime: string,
  countryCode = "DE"
): { ok: true } | { ok: false; error: string } {
  return validateShiftServiceHoursForArea(
    serviceHours,
    areaId,
    countryCode,
    shiftDate,
    startTime,
    endTime
  );
}
