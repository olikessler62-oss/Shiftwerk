import {
  validateShiftAgainstServiceHours,
  STAFFING_HOLIDAY_WEEKDAY,
  weekdayIndexFromDate,
} from "@schichtwerk/database";
import { isGermanPublicHoliday } from "@/lib/german-public-holidays";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";

export function serviceWeekdayForShiftDate(isoDate: string): number {
  if (isGermanPublicHoliday(isoDate)) return STAFFING_HOLIDAY_WEEKDAY;
  return weekdayIndexFromDate(isoDate);
}

export function validateDashboardShiftServiceHours(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  shiftDate: string,
  startTime: string,
  endTime: string
): { ok: true } | { ok: false; error: string } {
  const weekday = serviceWeekdayForShiftDate(shiftDate);
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
