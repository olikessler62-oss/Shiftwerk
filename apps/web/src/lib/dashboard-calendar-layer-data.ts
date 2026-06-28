import { shiftTimeFromTimestamp } from "@/lib/dates";
import { mapAreaCalendarShiftRowConfirmationFields } from "@/lib/area-calendar-shift-row-mapper";
import {
  resolvePlanningAreaId,
  resolvePlanningLocationId,
} from "@/lib/resolve-areacalendar-location";
import { findAreaShiftTemplateByTimes } from "@/lib/areacalendar-assignment-presets";
import type { PlanningShift } from "@/lib/planning-shift-card";
import { loadCommunicationHubScopeData } from "@/lib/communication-hub-scope-data";
import { organizationTodayISO } from "@schichtwerk/database";
import { resolveDashboardEmployeesForShifts } from "@/lib/dashboard-page-employees";
import { resolvePlanningShiftJobLabels } from "@/lib/planning-shift-job-label";
import type { SchichtwerkDatabase } from "@/lib/db";
import type { OrgFeatures } from "@/lib/org-features";
import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";
import type { Organization, Profile } from "@schichtwerk/types";
import type {
  AbsenceRequest,
  AreaShiftTemplateWithBreaks,
  Location,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  Qualification,
} from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import {
  loadDashboardLocationScopedData,
  resolveDashboardLocationScopedData,
} from "@/lib/dashboard-location-data";

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type DashboardCalendarLayerData = {
  employees: Profile[];
  shifts: PlanningShift[];
  locationShifts: PlanningShift[];
  areas: LocationArea[];
  selectedAreaId: string | null;
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: LocationAreaStaffing[];
  staffingOverrides: LocationAreaStaffingOverride[];
  communicationSwapRequests: CommunicationSwapRequestRow[];
  communicationCancelActors: Record<string, "employee" | "manager">;
  communicationHubLocationShifts: PlanningShift[];
  communicationHubAbsences: AbsenceRequest[];
};

export async function loadDashboardCalendarLayerData(input: {
  db: SchichtwerkDatabase;
  orgId: string;
  orgFeatures: OrgFeatures;
  organization: Organization;
  timeZone: string;
  weekStart: string;
  from: string;
  to: string;
  locationParam: string | undefined;
  areaParam: string | undefined;
  tentativeLocationId: string | undefined;
  locations: Location[];
  qualifications: Qualification[];
  profileQualificationIdsMap: Map<string, string[]>;
  planningEmployees: Profile[];
}): Promise<DashboardCalendarLayerData> {
  const {
    db,
    orgId,
    orgFeatures,
    organization,
    timeZone,
    weekStart,
    from,
    to,
    locationParam,
    areaParam,
    tentativeLocationId,
    locations,
    qualifications,
    profileQualificationIdsMap,
    planningEmployees,
  } = input;

  const selectedLocationId = resolvePlanningLocationId(
    locations,
    locationParam,
    tentativeLocationId
  );

  const locationScopedPrefetch = tentativeLocationId
    ? loadDashboardLocationScopedData(
        db,
        orgId,
        tentativeLocationId,
        weekStart,
        from,
        to
      )
    : null;

  const {
    areas,
    activeAreas,
    areaShiftTemplates,
    serviceHours,
    shiftRows,
    staffingRules,
    staffingOverrides,
  } = await resolveDashboardLocationScopedData(
    db,
    orgId,
    selectedLocationId,
    tentativeLocationId,
    weekStart,
    from,
    to,
    locationScopedPrefetch
  );

  const profileQualificationIds = Object.fromEntries(profileQualificationIdsMap);
  const selectedAreaId = resolvePlanningAreaId({
    calendarAreas: areas,
    activeAreas,
    areaParam,
    shiftAreaIds: shiftRows.map((shift) => shift.location_area_id),
  });

  const shifts: PlanningShift[] = [];
  const locationShifts: PlanningShift[] = [];
  for (const s of shiftRows) {
    const template = relation(s.area_shift_templates);
    const startFromTs = s.starts_at
      ? shiftTimeFromTimestamp(s.starts_at, timeZone)
      : template?.start_time?.slice(0, 5) ?? "00:00";
    const endFromTs = s.ends_at
      ? shiftTimeFromTimestamp(s.ends_at, timeZone)
      : template?.end_time?.slice(0, 5) ?? "00:00";
    const areaTemplate =
      !template && s.location_area_id
        ? findAreaShiftTemplateByTimes(
            s.location_area_id,
            startFromTs,
            endFromTs,
            areaShiftTemplates
          )
        : null;

    const confirmationFields = mapAreaCalendarShiftRowConfirmationFields(s);

    const planningShift: PlanningShift = {
      id: s.id,
      employee_id: s.employee_id,
      shift_date: s.shift_date,
      shiftName: template?.name ?? areaTemplate?.name ?? "",
      color: template?.color ?? areaTemplate?.color ?? "#64748b",
      startTime: startFromTs,
      endTime: endFromTs,
      location_area_id: s.location_area_id,
      area_shift_template_id:
        s.area_shift_template_id ?? areaTemplate?.id ?? null,
      confirmationStatus: confirmationFields.confirmationStatus,
      requestedAt: confirmationFields.requestedAt,
      confirmationStatusUpdatedAt: confirmationFields.confirmationStatusUpdatedAt,
      displayState: confirmationFields.displayState,
    };

    locationShifts.push(planningShift);

    if (
      orgFeatures.areas &&
      selectedAreaId &&
      s.location_area_id !== selectedAreaId
    ) {
      continue;
    }

    shifts.push(planningShift);
  }

  const qualificationNameById = new Map(
    qualifications.map((qualification) => [qualification.id, qualification.name])
  );
  const shiftJobLabels = resolvePlanningShiftJobLabels({
    shifts: locationShifts,
    serviceHours,
    staffingRules,
    profileQualificationIds,
    qualificationNameById,
    countryCode: organization.country_code,
  });
  for (const shift of locationShifts) {
    shift.jobName = shiftJobLabels.get(shift.id) ?? null;
  }

  const todayISO = organizationTodayISO(timeZone);
  const communicationHubScope = await loadCommunicationHubScopeData({
    db,
    orgId,
    organization,
    locationId: selectedLocationId,
    timeZone,
    todayISO,
    areaShiftTemplates,
  });

  const employees = await resolveDashboardEmployeesForShifts(
    planningEmployees,
    mergePlanningShiftsById(shifts, communicationHubScope.locationShifts),
    (id) => db.getProfileById(id),
    orgId
  );

  return {
    employees,
    shifts,
    locationShifts,
    areas,
    selectedAreaId,
    areaShiftTemplates,
    serviceHours,
    staffingRules,
    staffingOverrides,
    communicationSwapRequests: communicationHubScope.swapRequests,
    communicationCancelActors: communicationHubScope.cancelActors,
    communicationHubLocationShifts: communicationHubScope.locationShifts,
    communicationHubAbsences: communicationHubScope.absences,
  };
}

function mergePlanningShiftsById(
  primary: readonly PlanningShift[],
  secondary: readonly PlanningShift[]
): PlanningShift[] {
  const byId = new Map<string, PlanningShift>();
  for (const shift of primary) {
    byId.set(shift.id, shift);
  }
  for (const shift of secondary) {
    if (!byId.has(shift.id)) {
      byId.set(shift.id, shift);
    }
  }
  return [...byId.values()];
}
