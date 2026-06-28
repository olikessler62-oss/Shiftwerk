import { cookies } from "next/headers";
import { getDatabase } from "@/lib/db";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DashboardLocationPreferenceSync } from "@/components/dashboard/dashboard-location-preference-sync";
import { loadDashboardCalendarLayerData } from "@/lib/dashboard-calendar-layer-data";
import { resolvePlanningLocationId } from "@/lib/resolve-areacalendar-location";
import {
  PLANNING_SELECTED_LOCATION_COOKIE,
  readPlanningLocationCookie,
} from "@/lib/planning-location-preference";
import {
  resolveEmployeeCalendarPageFrame,
  type DashboardSearchParams,
} from "@/lib/dashboard-page-frame";

/** Mitarbeiter-Kalender: vollständiger Server-Load (kein gestaffeltes Hydration). */
export async function EmployeeCalendarPage({
  params,
}: {
  params: DashboardSearchParams;
}) {
  const frame = await resolveEmployeeCalendarPageFrame(params);
  const {
    user,
    organization,
    orgId,
    orgFeatures,
    timeZone,
    weekStart,
    dates,
    from,
    to,
    readOnlyWeek,
    locationParam,
    areaParam,
    loadSettingsModalsData,
  } = frame;

  const cookieStore = await cookies();
  const tentativeLocationId =
    locationParam ??
    readPlanningLocationCookie(
      cookieStore.get(PLANNING_SELECTED_LOCATION_COOKIE)?.value
    );

  const db = await getDatabase();

  // Group A: only what calendarData needs — start first
  const [planningEmployees, locations, qualifications, profileQualificationIdsMap] =
    await Promise.all([
      db.listPlanningEmployees(orgId),
      db.listLocations(orgId),
      db.listQualifications(orgId),
      db.listProfileQualificationIdsByOrganization(orgId),
    ]);

  // Group B + calendarData run in parallel — Group B no longer blocks calendarData
  const [
    calendarData,
    recurringAvailability,
    absences,
    settingsRoles,
    settingsProfiles,
    settingsCompensationSurchargeTypes,
    managerNotifications,
  ] = await Promise.all([
    loadDashboardCalendarLayerData({
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
    }),
    db.listOrganizationRecurringAvailability(orgId),
    db.listOrganizationAbsences(orgId, {
      statuses: ["approved"],
      overlappingFrom: from,
      overlappingTo: to,
    }),
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
    organization.shift_confirmation_enabled
      ? db.listManagerNotificationsForRecipient(user.id, { limit: 50 })
      : Promise.resolve([]),
  ]);

  const selectedLocationId = resolvePlanningLocationId(
    locations,
    locationParam,
    tentativeLocationId
  );

  const profileQualificationIds = Object.fromEntries(profileQualificationIdsMap);

  return (
    <>
      <DashboardLocationPreferenceSync locationId={selectedLocationId} />
      <DashboardView
        weekStart={weekStart}
        dates={dates}
        employees={calendarData.employees}
        shifts={calendarData.shifts}
        locationShifts={calendarData.locationShifts}
        recurringAvailability={recurringAvailability}
        absences={absences}
        communicationSwapRequests={calendarData.communicationSwapRequests}
        communicationCancelActors={calendarData.communicationCancelActors}
        communicationHubLocationShifts={calendarData.communicationHubLocationShifts}
        communicationHubAbsences={calendarData.communicationHubAbsences}
        organizationWeekShifts={calendarData.organizationWeekShifts}
        locations={locations}
        selectedLocationId={selectedLocationId}
        areas={calendarData.areas}
        selectedAreaId={calendarData.selectedAreaId}
        areaShiftTemplates={calendarData.areaShiftTemplates}
        serviceHours={calendarData.serviceHours}
        staffingRules={calendarData.staffingRules}
        staffingOverrides={calendarData.staffingOverrides}
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
    </>
  );
}
