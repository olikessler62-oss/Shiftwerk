import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type {
  LocationAreaServiceHour,
  LocationAreaStaffing,
  Qualification,
} from "@schichtwerk/types";

export type CalendarStaffingEditorData = {
  serviceHours: LocationAreaServiceHour[];
  staffing: LocationAreaStaffing[];
  qualifications: Qualification[];
};

export function buildCalendarStaffingEditorData(
  areaId: string,
  serviceHours: readonly AreaServiceHourRef[],
  staffingRules: readonly LocationAreaStaffing[],
  qualifications: readonly Qualification[]
): CalendarStaffingEditorData {
  const areaServiceHours: LocationAreaServiceHour[] = serviceHours
    .filter((hour) => hour.location_area_id === areaId)
    .map((hour) => ({
      id: hour.id,
      location_area_id: hour.location_area_id,
      weekday: hour.weekday,
      start_time: hour.start_time,
      end_time: hour.end_time,
    }));

  const staffing = staffingRules.filter(
    (rule) => rule.location_area_id === areaId
  );

  const activeQualifications = qualifications
    .filter((qualification) => !qualification.archived_at)
    .slice()
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.name.localeCompare(b.name, "de")
    );

  return {
    serviceHours: areaServiceHours,
    staffing,
    qualifications: activeQualifications,
  };
}
