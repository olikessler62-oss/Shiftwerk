import { shiftTimeFromTimestamp } from "@/lib/dates";
import { findAreaShiftTemplateByTimes } from "@/lib/areacalendar-assignment-presets";
import { formatTimeRange } from "@/lib/planning-utils";
import { loadDashboardLocationScopedData } from "@/lib/dashboard-location-data";
import { shouldDisplayShiftOnPlanningCalendar } from "@/lib/shift-cancellation-policy";
import { mapAreaCalendarShiftRowConfirmationFields } from "@/lib/area-calendar-shift-row-mapper";
import { loadCommunicationHubScopeData } from "@/lib/communication-hub-scope-data";
import { organizationTodayISO } from "@schichtwerk/database";
import { resolveDashboardEmployeesForShifts } from "@/lib/dashboard-page-employees";
import type { PlanningShift } from "@/lib/planning-shift-card";
import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";
import type {
  AbsenceRequest,
  AreaShiftTemplateWithBreaks,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  ManagerNotification,
  Organization,
  Profile,
  Qualification,
} from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { SchichtwerkDatabase } from "@/lib/db";

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type DashboardSummaryShift = {
  id: string;
  shiftDate: string;
  employeeName: string;
  areaName: string;
  shiftName: string;
  timeRange: string;
  startTime: string;
  color: string;
};

export type DashboardSummaryPageBundle = {
  summaryShifts: DashboardSummaryShift[];
  areas: LocationArea[];
  locationShifts: PlanningShift[];
  organizationWeekShifts: PlanningShift[];
  employees: Profile[];
  absences: AbsenceRequest[];
  communicationSwapRequests: CommunicationSwapRequestRow[];
  communicationCancelActors: Record<string, "employee" | "manager">;
  communicationHubLocationShifts: PlanningShift[];
  communicationHubAbsences: AbsenceRequest[];
  managerNotifications: ManagerNotification[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: LocationAreaStaffing[];
  staffingOverrides: LocationAreaStaffingOverride[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  profileQualificationIds: Record<string, string[]>;
};

const EMPTY_DASHBOARD_SUMMARY_PAGE_BUNDLE: DashboardSummaryPageBundle = {
  summaryShifts: [],
  areas: [],
  locationShifts: [],
  organizationWeekShifts: [],
  employees: [],
  absences: [],
  communicationSwapRequests: [],
  communicationCancelActors: {},
  communicationHubLocationShifts: [],
  communicationHubAbsences: [],
  managerNotifications: [],
  serviceHours: [],
  staffingRules: [],
  staffingOverrides: [],
  areaShiftTemplates: [],
  qualifications: [],
  profileQualificationIds: {},
};

export async function loadDashboardSummaryPageBundle(input: {
  db: SchichtwerkDatabase;
  orgId: string;
  userId: string;
  organization: Organization;
  locationId: string;
  weekStart: string;
  from: string;
  to: string;
  timeZone: string;
  planningEmployees: readonly Profile[];
}): Promise<DashboardSummaryPageBundle> {
  const {
    db,
    orgId,
    userId,
    organization,
    locationId,
    weekStart,
    from,
    to,
    timeZone,
    planningEmployees,
  } = input;

  const { areas, areaShiftTemplates, shiftRows, serviceHours, staffingRules, staffingOverrides } =
    await loadDashboardLocationScopedData(
      db,
      orgId,
      locationId,
      weekStart,
      from,
      to
    );

  const [qualifications, profileQualificationIdsMap] = await Promise.all([
    db.listQualifications(orgId),
    db.listProfileQualificationIdsByOrganization(orgId),
  ]);

  const areaNameById = new Map(areas.map((area) => [area.id, area.name]));
  const summaryShifts: DashboardSummaryShift[] = [];
  const locationShifts: PlanningShift[] = [];

  for (const shiftRow of shiftRows) {
    const template = relation(shiftRow.area_shift_templates);
    const profile = relation(shiftRow.profiles);
    const startFromTs = shiftRow.starts_at
      ? shiftTimeFromTimestamp(shiftRow.starts_at, timeZone)
      : template?.start_time?.slice(0, 5) ?? "00:00";
    const endFromTs = shiftRow.ends_at
      ? shiftTimeFromTimestamp(shiftRow.ends_at, timeZone)
      : template?.end_time?.slice(0, 5) ?? "00:00";
    const areaTemplate =
      !template && shiftRow.location_area_id
        ? findAreaShiftTemplateByTimes(
            shiftRow.location_area_id,
            startFromTs,
            endFromTs,
            areaShiftTemplates
          )
        : null;

    const confirmationFields = mapAreaCalendarShiftRowConfirmationFields(
      shiftRow
    );

    const planningShift: PlanningShift = {
      id: shiftRow.id,
      employee_id: shiftRow.employee_id,
      shift_date: shiftRow.shift_date,
      shiftName: template?.name ?? areaTemplate?.name ?? "",
      color: template?.color ?? areaTemplate?.color ?? "#64748b",
      startTime: startFromTs,
      endTime: endFromTs,
      location_id: locationId,
      location_area_id: shiftRow.location_area_id,
      area_shift_template_id:
        shiftRow.area_shift_template_id ?? areaTemplate?.id ?? null,
      confirmationStatus: confirmationFields.confirmationStatus,
      requestedAt: confirmationFields.requestedAt,
      confirmationStatusUpdatedAt: confirmationFields.confirmationStatusUpdatedAt,
      displayState: confirmationFields.displayState,
    };

    locationShifts.push(planningShift);

    if (
      !shouldDisplayShiftOnPlanningCalendar({
        id: shiftRow.id,
        shiftDate: shiftRow.shift_date,
        confirmationStatus: confirmationFields.confirmationStatus,
        cancelledBy: confirmationFields.displayState?.openCancellation
          ?.cancelledBy,
      })
    ) {
      continue;
    }

    const areaName =
      shiftRow.location_area_id
        ? areaNameById.get(shiftRow.location_area_id) ?? "—"
        : "—";

    summaryShifts.push({
      id: shiftRow.id,
      shiftDate: shiftRow.shift_date,
      employeeName: profile?.full_name ?? "Unbekannt",
      areaName,
      shiftName: template?.name ?? areaTemplate?.name ?? "Schicht",
      timeRange: formatTimeRange(startFromTs, endFromTs),
      startTime: startFromTs,
      color: template?.color ?? areaTemplate?.color ?? "#64748b",
    });
  }

  summaryShifts.sort((left, right) => {
    const dateCompare = left.shiftDate.localeCompare(right.shiftDate);
    if (dateCompare !== 0) return dateCompare;
    return left.startTime.localeCompare(right.startTime);
  });

  const todayISO = organizationTodayISO(timeZone);
  const [communicationHubScope, organizationShiftRows] = await Promise.all([
    loadCommunicationHubScopeData({
      db,
      orgId,
      organization,
      locationId,
      timeZone,
      todayISO,
      areaShiftTemplates,
    }),
    db.listOrganizationShiftsInDateRange(orgId, from, to),
  ]);

  const organizationWeekShifts: PlanningShift[] = organizationShiftRows.map(
    (shiftRow) => ({
      id: shiftRow.id,
      employee_id: shiftRow.employee_id,
      shift_date: shiftRow.shift_date,
      shiftName: "",
      color: "#64748b",
      startTime: shiftTimeFromTimestamp(shiftRow.starts_at, timeZone),
      endTime: shiftTimeFromTimestamp(shiftRow.ends_at, timeZone),
      location_id: shiftRow.location_id,
      location_area_id: shiftRow.location_area_id,
      area_shift_template_id: shiftRow.area_shift_template_id,
    })
  );

  const employees = await resolveDashboardEmployeesForShifts(
    planningEmployees,
    mergeSummaryPlanningShiftsById(locationShifts, communicationHubScope.locationShifts),
    (id) => db.getProfileById(id),
    orgId
  );

  const [absences, managerNotifications] = await Promise.all([
    db.listOrganizationAbsences(orgId, {
      statuses: ["approved"],
      overlappingFrom: from,
      overlappingTo: to,
    }),
    organization.shift_confirmation_enabled
      ? db.listManagerNotificationsForRecipient(userId, { limit: 50 })
      : Promise.resolve([]),
  ]);

  return {
    summaryShifts,
    areas,
    locationShifts,
    organizationWeekShifts,
    employees,
    absences,
    communicationSwapRequests: communicationHubScope.swapRequests,
    communicationCancelActors: communicationHubScope.cancelActors,
    communicationHubLocationShifts: communicationHubScope.locationShifts,
    communicationHubAbsences: communicationHubScope.absences,
    managerNotifications,
    serviceHours,
    staffingRules,
    staffingOverrides,
    areaShiftTemplates,
    qualifications,
    profileQualificationIds: Object.fromEntries(profileQualificationIdsMap),
  };
}

function mergeSummaryPlanningShiftsById(
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

export function emptyDashboardSummaryPageBundle(): DashboardSummaryPageBundle {
  return EMPTY_DASHBOARD_SUMMARY_PAGE_BUNDLE;
}
