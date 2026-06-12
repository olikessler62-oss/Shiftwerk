import type { LocationAreaStaffing } from "@schichtwerk/types";
import type { AreaServiceHourRef } from "./location-service-hours";
import {
  findServiceHourIdForShift,
  serviceWeekdayForShiftDate,
} from "./shift-service-hours";

export type ShiftStaffingQualificationStatus = "neutral" | "ok" | "missing";

export function staffingQualificationIdsForServiceHour(
  staffingRules: readonly LocationAreaStaffing[],
  areaId: string,
  serviceHourId: string | null | undefined
): Set<string> {
  const ids = new Set<string>();
  if (!serviceHourId) return ids;
  for (const rule of staffingRules) {
    if (
      rule.location_area_id !== areaId ||
      rule.service_hour_id !== serviceHourId ||
      rule.required_count <= 0
    ) {
      continue;
    }
    ids.add(rule.qualification_id);
  }
  return ids;
}

export function evaluateShiftStaffingQualification(input: {
  areaId: string;
  countryCode: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  employeeId: string;
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
  employeeQualificationIds: ReadonlySet<string>;
  qualificationNameById: ReadonlyMap<string, string>;
}): { status: ShiftStaffingQualificationStatus; missingNames: string[] } {
  const {
    areaId,
    countryCode,
    shiftDate,
    startTime,
    endTime,
    employeeId,
    serviceHours,
    staffingRules,
    employeeQualificationIds,
    qualificationNameById,
  } = input;

  const weekday = serviceWeekdayForShiftDate(countryCode, shiftDate);

  if (!employeeId || !startTime || !endTime) {
    return { status: "neutral", missingNames: [] };
  }

  const serviceHourId = findServiceHourIdForShift(
    serviceHours,
    areaId,
    weekday,
    startTime,
    endTime
  );
  if (!serviceHourId) {
    return { status: "neutral", missingNames: [] };
  }

  const requiredQualIds = staffingRules
    .filter(
      (rule) =>
        rule.location_area_id === areaId &&
        rule.service_hour_id === serviceHourId &&
        rule.required_count > 0
    )
    .map((rule) => rule.qualification_id);

  if (!requiredQualIds.length) {
    return { status: "neutral", missingNames: [] };
  }

  const hasMatch = requiredQualIds.some((id) =>
    employeeQualificationIds.has(id)
  );
  if (hasMatch) {
    return { status: "ok", missingNames: [] };
  }

  const missingNames = requiredQualIds.map(
    (id) => qualificationNameById.get(id) ?? id
  );
  return { status: "missing", missingNames };
}
