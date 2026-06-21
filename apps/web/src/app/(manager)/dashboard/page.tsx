import { redirect } from "next/navigation";
import {
  weekDates,
  shiftTimeFromTimestamp,
} from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import { getOrgFeatures } from "@/lib/org-features";
import { loadManagerOrganization } from "@/lib/manager";
import { isPastWeek } from "@/lib/planning-readonly";
import { resolveOrganizationTimeZone } from "@schichtwerk/database";
import { mapAreaCalendarShiftRowConfirmationFields } from "@/lib/area-calendar-shift-row-mapper";
import {
  resolveSelectedAreaId,
  resolveSelectedLocationId,
} from "@/lib/resolve-areacalendar-location";
import { findAreaShiftTemplateByTimes } from "@/lib/areacalendar-assignment-presets";
import {
  DashboardView,
  type PlanningShift,
} from "@/components/dashboard/dashboard-view";
import { redirectIfPlanningWeekClamped } from "@/lib/planning-week";
import { getCachedAreaCalendarShifts } from "@/lib/cached-areacalendar-shifts";
import { mapSwapRequestsToCommunicationRows } from "@/lib/communication-hub-data";
import { resolveDashboardEmployeesForShifts } from "@/lib/dashboard-page-employees";
import { resolvePlanningShiftJobLabels } from "@/lib/planning-shift-job-label";
import { hasSettingsModalSearchParam } from "@/lib/settings-modal-navigation";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";

export const dynamic = "force-dynamic";

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    location?: string;
    area?: string;
    standorte?: string;
    profiles?: string;
    rollen?: string;
    qualifikationen?: string;
    sonderzuschlaege?: string;
    abwesenheiten?: string;
    superadmin?: string;
  }>;
}) {
  const params = await searchParams;
  const {
    week,
    location: locationParam,
    area: areaParam,
  } = params;
  const db = await getDatabase();

  const user = await db.authGetUser();
  if (!user) redirect("/login");

  const orgId = await db.getProfileOrganizationId(user.id);
  if (!orgId) redirect("/login");

  const orgName = await db.getOrganizationName(orgId);
  const organization = await loadManagerOrganization(orgId, orgName);
  const managerNotifications = organization.shift_confirmation_enabled
    ? await db.listManagerNotificationsForRecipient(user.id, { limit: 50 })
    : [];
  const orgFeatures = getOrgFeatures(organization);
  const timeZone = resolveOrganizationTimeZone(organization);

  const weekStart = redirectIfPlanningWeekClamped("/dashboard", week, {
    week,
    location: locationParam,
    area: areaParam,
    ...params,
  });
  const dates = weekDates(weekStart);
  const from = dates[0];
  const to = dates[6];
  const readOnlyWeek = isPastWeek(to);

  const loadSettingsModalsData =
    SETTINGS_MODALS_ON_CURRENT_PAGE && hasSettingsModalSearchParam(params);

  const [
    employees,
    recurringAvailability,
    absences,
    locations,
    qualifications,
    profileQualificationIdsMap,
    settingsRoles,
    settingsProfiles,
    settingsCompensationSurchargeTypes,
  ] = await Promise.all([
    db.listPlanningEmployees(orgId),
    db.listOrganizationRecurringAvailability(orgId),
    db.listOrganizationAbsences(orgId, { statuses: ["approved"] }),
    db.listLocations(orgId),
    db.listQualifications(orgId),
    db.listProfileQualificationIdsByOrganization(orgId),
    loadSettingsModalsData
      ? db.listRoles(orgId).then(async (roles) => {
          if (!roles.length) {
            await db.seedDefaultRoles(orgId);
            return db.listRoles(orgId);
          }
          return roles;
        })
      : Promise.resolve([]),
    loadSettingsModalsData
      ? db.listOrganizationProfiles(orgId)
      : Promise.resolve([]),
    loadSettingsModalsData
      ? db.listCompensationSurchargeTypes(orgId)
      : Promise.resolve([]),
  ]);

  const selectedLocationId = resolveSelectedLocationId(locations, locationParam);

  const [areas, areaShiftTemplates, serviceHours, shiftRows, staffingRules, staffingOverrides] =
    selectedLocationId
      ? await Promise.all([
          db.listLocationAreas(selectedLocationId),
          db
            .listAreaShiftTemplatesWithBreaksForLocation(selectedLocationId)
            .catch(() => []),
          db.listLocationAreaServiceHours(selectedLocationId).catch(() => []),
          getCachedAreaCalendarShifts(
            orgId,
            selectedLocationId,
            weekStart,
            from,
            to
          ),
          db.listLocationAreaStaffing(selectedLocationId).catch(() => []),
          db
            .listLocationAreaStaffingOverrides(selectedLocationId, from, to)
            .catch(() => []),
        ])
      : [[], [], [], [], [], []];

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

  const planningEmployees = await resolveDashboardEmployeesForShifts(
    employees,
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

  return (
    <DashboardView
      weekStart={weekStart}
      dates={dates}
      employees={planningEmployees}
      shifts={shifts}
      locationShifts={locationShifts}
      recurringAvailability={recurringAvailability}
      absences={absences}
      communicationSwapRequests={communicationSwapRequests}
      communicationCancelActors={Object.fromEntries(cancelActorEntries)}
      locations={locations}
      selectedLocationId={selectedLocationId}
      areas={areas}
      selectedAreaId={selectedAreaId}
      areaShiftTemplates={areaShiftTemplates}
      serviceHours={serviceHours}
      staffingRules={staffingRules}
      staffingOverrides={staffingOverrides}
      qualifications={qualifications}
      profileQualificationIds={profileQualificationIds}
      readOnlyWeek={readOnlyWeek}
      managerNotifications={managerNotifications}
      settingsModals={
        loadSettingsModalsData
          ? {
              profiles: settingsProfiles,
              roles: settingsRoles,
              compensationSurchargeTypes: settingsCompensationSurchargeTypes,
            }
          : undefined
      }
    />
  );
}
