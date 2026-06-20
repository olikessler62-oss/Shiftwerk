import type { LocationAreaStaffing } from "@schichtwerk/types";
import type { AreaServiceHourRef } from "./location-service-hours";
import { findServiceHourIdForShift, serviceWeekdayForShiftDate } from "./shift-service-hours";
import { evaluateShiftStaffingQualification } from "./shift-staffing-qualification";

export function hasStaffingDemandForShiftWindow(input: {
  areaId: string;
  countryCode: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
}): boolean {
  const weekday = serviceWeekdayForShiftDate(input.countryCode, input.shiftDate);
  const serviceHourId = findServiceHourIdForShift(
    input.serviceHours,
    input.areaId,
    weekday,
    input.startTime,
    input.endTime
  );
  if (!serviceHourId) return false;

  return input.staffingRules.some(
    (rule) =>
      rule.location_area_id === input.areaId &&
      rule.service_hour_id === serviceHourId &&
      rule.required_count > 0
  );
}

export function employeeMeetsStaffingDemandQualification(input: {
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
}): boolean {
  const qualificationCheck = evaluateShiftStaffingQualification({
    areaId: input.areaId,
    countryCode: input.countryCode,
    shiftDate: input.shiftDate,
    startTime: input.startTime,
    endTime: input.endTime,
    employeeId: input.employeeId,
    serviceHours: input.serviceHours,
    staffingRules: input.staffingRules,
    employeeQualificationIds: input.employeeQualificationIds,
    qualificationNameById: input.qualificationNameById,
  });

  return qualificationCheck.status !== "missing";
}

/** Bedarf für Schichtfenster vorhanden und Mitarbeiter bringt passende Qualifikation mit. */
export function restWeekStaffingDemandEligible(input: {
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
}): boolean {
  if (
    !hasStaffingDemandForShiftWindow({
      areaId: input.areaId,
      countryCode: input.countryCode,
      shiftDate: input.shiftDate,
      startTime: input.startTime,
      endTime: input.endTime,
      serviceHours: input.serviceHours,
      staffingRules: input.staffingRules,
    })
  ) {
    return false;
  }

  return employeeMeetsStaffingDemandQualification(input);
}
