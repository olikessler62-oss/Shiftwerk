import { cookies } from "next/headers";
import { getDatabase } from "@/lib/db";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DashboardLocationPreferenceSync } from "@/components/dashboard/dashboard-location-preference-sync";
import {
  PLANNING_SELECTED_LOCATION_COOKIE,
  readPlanningLocationCookie,
} from "@/lib/planning-location-preference";
import {
  resolveDashboardPageFrame,
  type DashboardSearchParams,
} from "@/lib/dashboard-page-frame";

/** Schneller Shell-Load: Header + Rahmen, Kalender folgt per Suspense. */
export async function DashboardPageShell({
  params,
}: {
  params: DashboardSearchParams;
}) {
  const frame = await resolveDashboardPageFrame(params);
  const {
    user,
    organization,
    orgId,
    weekStart,
    dates,
    from,
    to,
    readOnlyWeek,
    locationParam,
    loadSettingsModalsData,
  } = frame;

  const db = await getDatabase();

  const [
    planningEmployees,
    recurringAvailability,
    absences,
    locations,
    qualifications,
    profileQualificationIdsMap,
    settingsRoles,
    settingsProfiles,
    settingsCompensationSurchargeTypes,
    managerNotifications,
  ] = await Promise.all([
    db.listPlanningEmployees(orgId),
    db.listOrganizationRecurringAvailability(orgId),
    db.listOrganizationAbsences(orgId, {
      statuses: ["approved"],
      overlappingFrom: from,
      overlappingTo: to,
    }),
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
    organization.shift_confirmation_enabled
      ? db.listManagerNotificationsForRecipient(user.id, { limit: 50 })
      : Promise.resolve([]),
  ]);

  const selectedLocationId = resolveSelectedLocationId(locations, locationParam);
  const profileQualificationIds = Object.fromEntries(profileQualificationIdsMap);

  return (
    <>
      <DashboardLocationPreferenceSync locationId={selectedLocationId} />
      <DashboardView
        weekStart={weekStart}
        dates={dates}
        employees={planningEmployees}
        shifts={[]}
        locationShifts={[]}
        recurringAvailability={recurringAvailability}
        absences={absences}
        communicationSwapRequests={[]}
        communicationCancelActors={{}}
        locations={locations}
        selectedLocationId={selectedLocationId}
        areas={[]}
        selectedAreaId={null}
        areaShiftTemplates={[]}
        serviceHours={[]}
        staffingRules={[]}
        staffingOverrides={[]}
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
