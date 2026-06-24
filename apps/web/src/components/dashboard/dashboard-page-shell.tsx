import { cookies } from "next/headers";
import { getDatabase } from "@/lib/db";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
import { DashboardSummaryShell } from "@/components/dashboard/dashboard-summary-shell";
import { DashboardLocationPreferenceSync } from "@/components/dashboard/dashboard-location-preference-sync";
import {
  PLANNING_SELECTED_LOCATION_COOKIE,
  readPlanningLocationCookie,
} from "@/lib/planning-location-preference";
import {
  emptyDashboardSummaryPageBundle,
  loadDashboardSummaryPageBundle,
} from "@/lib/dashboard-summary-data";
import {
  resolveDashboardPageFrame,
  type DashboardSearchParams,
} from "@/lib/dashboard-page-frame";

/** Dashboard: Schichtübersicht als Liste (kein Kalender). */
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
    timeZone,
    weekStart,
    dates,
    from,
    to,
    readOnlyWeek,
    locationParam,
    loadSettingsModalsData,
  } = frame;

  const db = await getDatabase();

  const [locations, planningEmployees, settingsRoles, settingsProfiles, settingsCompensationSurchargeTypes] =
    await Promise.all([
      db.listLocations(orgId),
      db.listPlanningEmployees(orgId),
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

  const cookieStore = await cookies();
  const selectedLocationId = resolveSelectedLocationId(
    locations,
    locationParam ??
      readPlanningLocationCookie(
        cookieStore.get(PLANNING_SELECTED_LOCATION_COOKIE)?.value
      )
  );
  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? null;

  const summaryBundle =
    selectedLocationId
      ? await loadDashboardSummaryPageBundle({
          db,
          orgId,
          userId: user.id,
          organization,
          locationId: selectedLocationId,
          weekStart,
          from,
          to,
          timeZone,
          planningEmployees,
        })
      : emptyDashboardSummaryPageBundle();

  return (
    <>
      <DashboardLocationPreferenceSync locationId={selectedLocationId} />
      <DashboardSummaryShell
        weekStart={weekStart}
        dates={dates}
        locations={locations}
        selectedLocationId={selectedLocationId}
        selectedLocationName={selectedLocation?.name}
        areas={summaryBundle.areas}
        locationShifts={summaryBundle.locationShifts}
        employees={summaryBundle.employees}
        serviceHours={summaryBundle.serviceHours}
        staffingRules={summaryBundle.staffingRules}
        staffingOverrides={summaryBundle.staffingOverrides}
        areaShiftTemplates={summaryBundle.areaShiftTemplates}
        qualifications={summaryBundle.qualifications}
        profileQualificationIds={summaryBundle.profileQualificationIds}
        absences={summaryBundle.absences}
        communicationSwapRequests={summaryBundle.communicationSwapRequests}
        communicationCancelActors={summaryBundle.communicationCancelActors}
        managerNotifications={summaryBundle.managerNotifications}
        readOnlyWeek={readOnlyWeek}
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
