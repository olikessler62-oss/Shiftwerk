/** Montag = 0 … Sonntag = 6, Feiertage = 7 */
export const SERVICE_HOLIDAY_WEEKDAY = 7;

export const SERVICE_HOURS_MIGRATION_HINT =
  "Datenbank-Migration 20250618_location_area_service_hours.sql ausführen.";

export function isServiceHoursTableUnavailable(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("location_area_service_hours") &&
    (lower.includes("does not exist") ||
      lower.includes("could not find the table") ||
      lower.includes("schema cache"))
  );
}

export type AreaServiceHourRef = {
  location_area_id: string;
  weekday: number;
  start_time?: string;
  end_time?: string;
  id?: string;
};

export function isAreaOpenOnWeekday(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  weekday: number
): boolean {
  return serviceHours.some(
    (h) => h.location_area_id === areaId && h.weekday === weekday
  );
}

export function isStaffingDayEnabled(
  serviceHours: AreaServiceHourRef[],
  areaId: string,
  weekday: number
): boolean {
  return isAreaOpenOnWeekday(serviceHours, areaId, weekday);
}
