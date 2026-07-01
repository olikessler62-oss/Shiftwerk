import {
  DEFAULT_COUNTRY_CODE,
  mergeShiftAssignWarnings,
  type SchichtwerkDatabase,
  type ShiftAssignEligibilityContext,
  validateShiftAssignEligibility,
  validateShiftEmployeeEligibility,
} from "@schichtwerk/database";
import type { PlanningMode, Qualification } from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@schichtwerk/database";

export type ShiftAssignValidationContext = ShiftAssignEligibilityContext;

function toServiceHourRefs(
  hours: {
    id: string;
    location_area_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
  }[]
): AreaServiceHourRef[] {
  return hours.map((hour) => ({
    id: hour.id,
    location_area_id: hour.location_area_id,
    weekday: hour.weekday,
    start_time: hour.start_time,
    end_time: hour.end_time,
  }));
}

export async function loadShiftAssignValidationContext(
  db: SchichtwerkDatabase,
  organizationId: string,
  planningMode: PlanningMode,
  locationId: string,
  locationAreaId: string | null
): Promise<ShiftAssignValidationContext> {
  const needsAdvancedData =
    planningMode === "advanced" && locationAreaId != null;

  const [
    countryCode,
    recurringAvailability,
    absences,
    staffingRules,
    serviceHours,
    qualificationMap,
    qualifications,
  ] = await Promise.all([
    db.getOrganizationCountryCode(organizationId),
    db.listOrganizationRecurringAvailability(organizationId),
    db.listOrganizationAbsences(organizationId, { statuses: ["approved"] }),
    needsAdvancedData
      ? db.listLocationAreaStaffingForArea(locationAreaId!, locationId)
      : Promise.resolve([]),
    needsAdvancedData
      ? db.listLocationAreaServiceHoursForArea(locationAreaId!, locationId)
      : Promise.resolve([]),
    needsAdvancedData
      ? db.listProfileQualificationIdsByOrganization(organizationId)
      : Promise.resolve(new Map<string, string[]>()),
    needsAdvancedData
      ? db.listQualifications(organizationId)
      : Promise.resolve([] as Qualification[]),
  ]);

  const profileQualificationIds = new Map<string, Set<string>>();
  for (const [profileId, ids] of qualificationMap.entries()) {
    profileQualificationIds.set(profileId, new Set(ids));
  }

  const qualificationNameById = new Map<string, string>();
  for (const qualification of qualifications) {
    qualificationNameById.set(qualification.id, qualification.name);
  }

  return {
    countryCode: countryCode ?? DEFAULT_COUNTRY_CODE,
    recurringAvailability,
    absences,
    staffingRules: needsAdvancedData ? staffingRules : undefined,
    serviceHours: needsAdvancedData ? toServiceHourRefs(serviceHours) : undefined,
    profileQualificationIds: needsAdvancedData
      ? profileQualificationIds
      : undefined,
    qualificationNameById: needsAdvancedData ? qualificationNameById : undefined,
  };
}

export {
  mergeShiftAssignWarnings,
  validateShiftAssignEligibility,
  validateShiftEmployeeEligibility,
};
