import { cookies } from "next/headers";
import { getDatabase } from "@/lib/db";
import { DashboardCalendarHydrator } from "@/components/dashboard/dashboard-calendar-hydrator";
import { loadDashboardCalendarLayerData } from "@/lib/dashboard-calendar-layer-data";
import {
  PLANNING_SELECTED_LOCATION_COOKIE,
  readPlanningLocationCookie,
} from "@/lib/planning-location-preference";
import {
  resolveDashboardPageFrame,
  type DashboardSearchParams,
} from "@/lib/dashboard-page-frame";

export async function DashboardCalendarLayer({
  params,
}: {
  params: DashboardSearchParams;
}) {
  const frame = await resolveDashboardPageFrame(params);
  const {
    organization,
    orgId,
    orgFeatures,
    timeZone,
    weekStart,
    from,
    to,
    locationParam,
    areaParam,
  } = frame;

  const cookieStore = await cookies();
  const tentativeLocationId =
    locationParam ??
    readPlanningLocationCookie(
      cookieStore.get(PLANNING_SELECTED_LOCATION_COOKIE)?.value
    );

  const db = await getDatabase();

  const [planningEmployees, locations, qualifications, profileQualificationIdsMap] =
    await Promise.all([
      db.listPlanningEmployees(orgId),
      db.listLocations(orgId),
      db.listQualifications(orgId),
      db.listProfileQualificationIdsByOrganization(orgId),
    ]);

  const calendarData = await loadDashboardCalendarLayerData({
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
  });

  return <DashboardCalendarHydrator data={calendarData} />;
}
