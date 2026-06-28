import { cookies } from "next/headers";
import { getDatabase } from "@/lib/db";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
import {
  PLANNING_SELECTED_LOCATION_COOKIE,
  readPlanningLocationCookie,
} from "@/lib/planning-location-preference";
import { resolveDashboardPageFrame } from "@/lib/dashboard-page-frame";
import {
  emptyDashboardExtPanelSnapshot,
  loadDashboardExtPanelSnapshot,
  type DashboardExtPanelSnapshot,
} from "@/lib/dashboard-ext-panel-data";
import {
  emptyDashboardSummaryPageBundle,
  type DashboardSummaryPageBundle,
} from "@/lib/dashboard-summary-data";
import type { DashboardSearchParams } from "@/lib/dashboard-page-frame";
import type {
  CompensationSurchargeType,
  Location,
  Profile,
  Role,
} from "@schichtwerk/types";

export type DashboardSettingsModalsData = {
  roles: Role[];
  profiles: Profile[];
  compensationSurchargeTypes: CompensationSurchargeType[];
};

export type DashboardPageData = {
  snapshot: DashboardExtPanelSnapshot;
  weekStart: string;
  dates: string[];
  locations: Location[];
  selectedLocationId: string | null;
  communicationBundle: DashboardSummaryPageBundle;
  settingsModals: DashboardSettingsModalsData;
};

export async function loadDashboardPageData(
  params: DashboardSearchParams
): Promise<DashboardPageData> {
  const frame = await resolveDashboardPageFrame(params);
  const { weekStart, dates, locationParam, orgId } = frame;

  const db = await getDatabase();
  const locations = await db.listLocations(orgId);

  const cookieStore = await cookies();
  const selectedLocationId = resolveSelectedLocationId(
    locations,
    locationParam ??
      readPlanningLocationCookie(
        cookieStore.get(PLANNING_SELECTED_LOCATION_COOKIE)?.value
      )
  );

  const result = await loadDashboardExtPanelSnapshot({
    week: params.week,
    location: selectedLocationId ?? locationParam,
  });

  const snapshot =
    result.ok && result.data.locationId
      ? result.data
      : {
          ...emptyDashboardExtPanelSnapshot(),
          weekStart,
          dates,
          locationId: selectedLocationId,
          locationName:
            locations.find((location) => location.id === selectedLocationId)
              ?.name ?? "",
        };

  const communicationBundle =
    result.ok && result.bundle ? result.bundle : emptyDashboardSummaryPageBundle();

  let [roles, profiles, compensationSurchargeTypes] = await Promise.all([
    db.listRoles(orgId),
    db.listOrganizationProfiles(orgId),
    db.listCompensationSurchargeTypes(orgId),
  ]);

  if (!roles.length) {
    await db.seedDefaultRoles(orgId);
    roles = await db.listRoles(orgId);
  }

  return {
    snapshot,
    weekStart,
    dates,
    locations,
    selectedLocationId,
    communicationBundle,
    settingsModals: {
      roles,
      profiles,
      compensationSurchargeTypes,
    },
  };
}
