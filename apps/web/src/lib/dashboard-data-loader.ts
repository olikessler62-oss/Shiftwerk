import { cookies } from "next/headers";
import { getDatabase } from "@/lib/db";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
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

export type DashboardPageData = Awaited<ReturnType<typeof loadDashboardPageData>>;

export async function loadDashboardPageData(params: DashboardSearchParams) {
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

  const summaryBundle = selectedLocationId
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

  return {
    weekStart,
    dates,
    locations,
    selectedLocationId,
    selectedLocation,
    summaryBundle,
    readOnlyWeek,
    loadSettingsModalsData,
    settingsRoles,
    settingsProfiles,
    settingsCompensationSurchargeTypes,
  };
}
