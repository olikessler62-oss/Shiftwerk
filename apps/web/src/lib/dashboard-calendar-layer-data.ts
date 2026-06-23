import { shiftTimeFromTimestamp } from "@/lib/dates";
import { mapAreaCalendarShiftRowConfirmationFields } from "@/lib/area-calendar-shift-row-mapper";
import {
  resolvePlanningLocationId,
  resolveSelectedAreaId,
} from "@/lib/resolve-areacalendar-location";
import { findAreaShiftTemplateByTimes } from "@/lib/areacalendar-assignment-presets";
import type { PlanningShift } from "@/lib/planning-shift-card";
import { mapSwapRequestsToCommunicationRows } from "@/lib/communication-hub-data";
import { resolveDashboardEmployeesForShifts } from "@/lib/dashboard-page-employees";
import { resolvePlanningShiftJobLabels } from "@/lib/planning-shift-job-label";
import type { SchichtwerkDatabase } from "@/lib/db";
import type { OrgFeatures } from "@/lib/org-features";
import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";
import type { Organization, Profile } from "@schichtwerk/types";
import type {
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
  const selectedAreaId = resolveSelectedAreaId(areas, areaParam);

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

  const employees = await resolveDashboardEmployeesForShifts(
    planningEmployees,
    shifts,
    (id) => db.getProfileById(id),
    orgId
  );

  const canceledShiftIds = locationShifts
    .filter((shift) => shift.confirmationStatus === "canceled")
    .filter((shift) => !shift.displayState?.openCancellation?.cancelledBy)
    .map((shift) => shift.id);

  const [swapRequestRows, cancelActorEntries] =
    selectedLocationId && organization.shift_confirmation_enabled
      ? await Promise.all([
          db.listOrganizationSwapRequests(orgId, {
            statuses: ["pending"],
            locationId: selectedLocationId,
            from,
            to,
          }),
          db.listShiftCancelActors(orgId, canceledShiftIds),
        ])
      : [[], new Map<string, "employee" | "manager">()];

  const communicationSwapRequests = mapSwapRequestsToCommunicationRows(
    swapRequestRows,
    timeZone
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
    communicationSwapRequests,
    communicationCancelActors: Object.fromEntries(cancelActorEntries),
  };
}
