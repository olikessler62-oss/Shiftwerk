import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  weekDates,
  shiftTimeFromTimestamp,
} from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import { getManagerSession } from "@/lib/server-manager-session";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
import { findAreaShiftTemplateByTimes } from "@/lib/areacalendar-assignment-presets";
import { AreaCalendarView } from "@/components/areacalendar/areacalendar-view";
import { PlanningPageContentLoading } from "@/components/planning/planning-page-content-loading";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-calendar";
import { organizationTodayISO, resolveOrganizationTimeZone, resolveOrganizationShiftConfirmationPendingAfterMinutes } from "@schichtwerk/database";
import { mapAreaCalendarShiftRowConfirmationFields } from "@/lib/area-calendar-shift-row-mapper";
import { redirectIfPlanningWeekClamped } from "@/lib/planning-week";
import { loadDashboardLocationScopedData } from "@/lib/dashboard-location-data";
import { loadCommunicationHubScopeData } from "@/lib/communication-hub-scope-data";
import { resolvePlanningShiftJobLabels } from "@/lib/planning-shift-job-label";
import { hasSettingsModalSearchParam } from "@/lib/settings-modal-navigation";
import type { CompensationSurchargeType, Profile, Role } from "@schichtwerk/types";

export const dynamic = "force-dynamic";

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function loadSettingsRoles(
  db: Awaited<ReturnType<typeof getDatabase>>,
  orgId: string
): Promise<Role[]> {
  let roles = await db.listRoles(orgId);
  if (!roles.length) {
    await db.seedDefaultRoles(orgId);
    roles = await db.listRoles(orgId);
  }
  return roles;
}

export default async function BereichKalenderPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    qualifikationen?: string;
    standorte?: string;
    profiles?: string;
    rollen?: string;
    location?: string;
    area?: string;
  }>;
}) {
  const {
    week,
    location: locationParam,
    qualifikationen,
    standorte,
    profiles: profilesParam,
    rollen,
    area: areaParam,
  } = await searchParams;

  const session = await getManagerSession();
  if (!session) redirect("/login");

  const { user, organization, organizationId: orgId } = session;
  const timeZone = resolveOrganizationTimeZone(organization);
  const pendingAfterMinutes =
    resolveOrganizationShiftConfirmationPendingAfterMinutes(organization);

  const weekStart = redirectIfPlanningWeekClamped("/bereich-kalender", week, {
    week,
    location: locationParam,
    area: areaParam,
    qualifikationen,
    standorte,
    profiles: profilesParam,
    rollen,
  });
  const dates = weekDates(weekStart);
  const from = dates[0];
  const to = dates[6];

  const loadSettingsModalsData = hasSettingsModalSearchParam({
    qualifikationen,
    standorte,
    profiles: profilesParam,
    rollen,
  });

  const db = await getDatabase();

  let [
    qualifications,
    compensationSurchargeTypes,
    roles,
    settingsProfiles,
    planningEmployees,
    locations,
    profileQualificationIdsMap,
    absences,
    recurringAvailability,
    managerNotifications,
  ] = await Promise.all([
    db.listQualifications(orgId),
    loadSettingsModalsData
      ? db.listCompensationSurchargeTypes(orgId)
      : Promise.resolve([] as CompensationSurchargeType[]),
    loadSettingsModalsData
      ? loadSettingsRoles(db, orgId)
      : Promise.resolve([] as Role[]),
    loadSettingsModalsData
      ? db.listOrganizationProfiles(orgId)
      : Promise.resolve([] as Profile[]),
    db.listPlanningEmployees(orgId),
    db.listLocationsForAreaCalendar(orgId, from, to),
    db.listProfileQualificationIdsByOrganization(orgId),
    db.listOrganizationAbsences(orgId, {
      statuses: ["approved"],
      overlappingFrom: from,
      overlappingTo: to,
    }),
    db.listOrganizationRecurringAvailability(orgId),
    organization.shift_confirmation_enabled
      ? db.listManagerNotificationsForRecipient(user.id, { limit: 50 })
      : Promise.resolve([]),
  ]);

  const selectedLocationId = resolveSelectedLocationId(locations, locationParam);
  const selectedLocation =
    locations.find((l) => l.id === selectedLocationId) ?? null;

  const locationScopedData = selectedLocationId
    ? await loadDashboardLocationScopedData(
        db,
        orgId,
        selectedLocationId,
        weekStart,
        from,
        to
      )
    : null;

  const areas = locationScopedData?.areas ?? [];
  const staffingRules = locationScopedData?.staffingRules ?? [];
  const serviceHours = locationScopedData?.serviceHours ?? [];
  const shiftRows = locationScopedData?.shiftRows ?? [];
  const areaShiftTemplates = locationScopedData?.areaShiftTemplates ?? [];
  const staffingOverrides = locationScopedData?.staffingOverrides ?? [];

  const cards: AreaCalendarShiftCard[] = [];
  for (const s of shiftRows) {
    const template = relation(s.area_shift_templates);
    const profile = relation(s.profiles);
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

    const confirmationFields = mapAreaCalendarShiftRowConfirmationFields(
      s,
      pendingAfterMinutes
    );

    cards.push({
      id: s.id,
      shift_date: s.shift_date,
      locationAreaId: s.location_area_id,
      areaShiftTemplateId: s.area_shift_template_id,
      employeeId: s.employee_id,
      shiftName: template?.name ?? areaTemplate?.name ?? "",
      color: template?.color ?? areaTemplate?.color ?? profile?.color ?? "#64748b",
      startTime: startFromTs,
      endTime: endFromTs,
      employeeName: profile?.full_name ?? "Unbekannt",
      employeeColor: profile?.color ?? null,
      confirmationStatus: confirmationFields.confirmationStatus,
      requestedAt: confirmationFields.requestedAt,
      confirmationStatusUpdatedAt: confirmationFields.confirmationStatusUpdatedAt,
      displayState: confirmationFields.displayState,
    });
  }

  const qualificationNameById = new Map(
    qualifications.map((qualification) => [qualification.id, qualification.name])
  );
  const shiftJobLabels = resolvePlanningShiftJobLabels({
    shifts: cards.map((card) => ({
      id: card.id,
      employee_id: card.employeeId,
      shift_date: card.shift_date,
      shiftName: card.shiftName,
      color: card.color,
      startTime: card.startTime,
      endTime: card.endTime,
      location_area_id: card.locationAreaId,
      area_shift_template_id: card.areaShiftTemplateId,
    })),
    serviceHours,
    staffingRules,
    profileQualificationIds: Object.fromEntries(profileQualificationIdsMap),
    qualificationNameById,
    countryCode: organization.country_code,
  });
  for (const card of cards) {
    card.jobName = shiftJobLabels.get(card.id) ?? null;
  }

  const profileQualificationIds = Object.fromEntries(profileQualificationIdsMap);
  const planningEmployeeIds = planningEmployees.map((employee) => employee.id);
  const settingsModalsProfiles = loadSettingsModalsData
    ? settingsProfiles
    : planningEmployees;

  const todayISO = organizationTodayISO(timeZone);
  const [communicationHubScope, organizationShiftRows] = await Promise.all([
    loadCommunicationHubScopeData({
      db,
      orgId,
      organization,
      locationId: selectedLocationId,
      timeZone,
      todayISO,
      areaShiftTemplates,
    }),
    db.listOrganizationShiftsInDateRange(orgId, from, to, planningEmployeeIds),
  ]);

  const organizationWeekShifts = organizationShiftRows.map((shiftRow) => ({
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
  }));

  return (
    <Suspense fallback={<PlanningPageContentLoading />}>
      <AreaCalendarView
        weekStart={weekStart}
        dates={dates}
        selectedLocationId={selectedLocationId}
        selectedLocation={selectedLocation}
        areas={areas}
        staffingRules={staffingRules}
        fullStaffingRules={staffingRules}
        staffingOverrides={staffingOverrides}
        serviceHours={serviceHours}
        shifts={cards}
        areaShiftTemplates={areaShiftTemplates}
        qualifications={qualifications}
        compensationSurchargeTypes={compensationSurchargeTypes}
        roles={roles}
        profiles={planningEmployees}
        profileQualificationIds={profileQualificationIds}
        locations={locations}
        absences={absences}
        recurringAvailability={recurringAvailability}
        communicationSwapRequests={communicationHubScope.swapRequests}
        communicationCancelActors={communicationHubScope.cancelActors}
        communicationHubLocationShifts={communicationHubScope.locationShifts}
        organizationWeekShifts={organizationWeekShifts}
        communicationHubAbsences={communicationHubScope.absences}
        managerNotifications={managerNotifications}
        settingsModalsProfiles={settingsModalsProfiles}
      />
    </Suspense>
  );
}
