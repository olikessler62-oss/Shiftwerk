import { redirect } from "next/navigation";
import {
  weekDates,
  shiftTimeFromTimestamp,
} from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import { getOrgFeatures } from "@/lib/org-features";
import { loadManagerOrganization } from "@/lib/manager";
import { isPastWeek } from "@/lib/planning-readonly";
import { resolveOrganizationTimeZone, resolveEffectiveConfirmationStatus } from "@schichtwerk/database";
import {
  resolveSelectedAreaId,
  resolveSelectedLocationId,
} from "@/lib/resolve-dashboard-location";
import { findAreaShiftTemplateByTimes } from "@/lib/dashboard-assignment-presets";
import {
  ShiftPlanner,
  type PlanningShift,
} from "@/components/planning/shift-planner";
import { redirectIfPlanningWeekClamped } from "@/lib/planning-week";
import { getCachedDashboardShifts } from "@/lib/cached-dashboard-shifts";
import { resolvePlanningEmployeesForShifts } from "@/lib/planning-page-employees";
import { hasSettingsModalSearchParam } from "@/lib/settings-modal-navigation";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function PlanerPage({
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
    arbeitsentgelt?: string;
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

  const weekStart = redirectIfPlanningWeekClamped("/planer", week, {
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

  const [areas, areaShiftTemplates, serviceHours, shiftRows, staffingRules] =
    selectedLocationId
      ? await Promise.all([
          db.listLocationAreas(selectedLocationId),
          db
            .listAreaShiftTemplatesWithBreaksForLocation(selectedLocationId)
            .catch(() => []),
          db.listLocationAreaServiceHours(selectedLocationId).catch(() => []),
          getCachedDashboardShifts(
            orgId,
            selectedLocationId,
            weekStart,
            from,
            to
          ),
          db.listLocationAreaStaffing(selectedLocationId).catch(() => []),
        ])
      : [[], [], [], [], []];

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
      confirmationStatus: resolveEffectiveConfirmationStatus(
        s.confirmation_status,
        s.requested_at
      ),
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

  const planningEmployees = await resolvePlanningEmployeesForShifts(
    employees,
    shifts,
    (id) => db.getProfileById(id),
    orgId
  );

  return (
    <ShiftPlanner
      weekStart={weekStart}
      dates={dates}
      employees={planningEmployees}
      shifts={shifts}
      locationShifts={locationShifts}
      recurringAvailability={recurringAvailability}
      absences={absences}
      locations={locations}
      selectedLocationId={selectedLocationId}
      areas={areas}
      selectedAreaId={selectedAreaId}
      areaShiftTemplates={areaShiftTemplates}
      serviceHours={serviceHours}
      staffingRules={staffingRules}
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
