import type { SchichtwerkDatabase } from "@schichtwerk/database";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
} from "@schichtwerk/types";
import { getCachedAreaCalendarShifts } from "@/lib/cached-areacalendar-shifts";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";

export type DashboardLocationScopedData = {
  areas: LocationArea[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  serviceHours: AreaServiceHourRef[];
  shiftRows: Awaited<
    ReturnType<SchichtwerkDatabase["listAreaCalendarShifts"]>
  >;
  staffingRules: LocationAreaStaffing[];
  staffingOverrides: LocationAreaStaffingOverride[];
};

export const EMPTY_DASHBOARD_LOCATION_SCOPED_DATA: DashboardLocationScopedData = {
  areas: [],
  areaShiftTemplates: [],
  serviceHours: [],
  shiftRows: [],
  staffingRules: [],
  staffingOverrides: [],
};

export async function loadDashboardLocationScopedData(
  db: SchichtwerkDatabase,
  orgId: string,
  locationId: string,
  weekStart: string,
  from: string,
  to: string
): Promise<DashboardLocationScopedData> {
  const [
    areas,
    areaShiftTemplates,
    serviceHours,
    shiftRows,
    staffingRules,
    staffingOverrides,
  ] = await Promise.all([
    db.listLocationAreas(locationId),
    db.listAreaShiftTemplatesWithBreaksForLocation(locationId).catch(() => []),
    db.listLocationAreaServiceHours(locationId).catch(() => []),
    getCachedAreaCalendarShifts(orgId, locationId, weekStart, from, to),
    db.listLocationAreaStaffing(locationId).catch(() => []),
    db.listLocationAreaStaffingOverrides(locationId, from, to).catch(() => []),
  ]);

  return {
    areas,
    areaShiftTemplates,
    serviceHours,
    shiftRows,
    staffingRules,
    staffingOverrides,
  };
}

/** Nutzt Prefetch, wenn tentative Location mit der gewählten übereinstimmt. */
export async function resolveDashboardLocationScopedData(
  db: SchichtwerkDatabase,
  orgId: string,
  selectedLocationId: string | null,
  tentativeLocationId: string | undefined,
  weekStart: string,
  from: string,
  to: string,
  prefetchPromise: Promise<DashboardLocationScopedData> | null
): Promise<DashboardLocationScopedData> {
  if (!selectedLocationId) {
    return EMPTY_DASHBOARD_LOCATION_SCOPED_DATA;
  }

  if (tentativeLocationId === selectedLocationId && prefetchPromise) {
    return prefetchPromise;
  }

  return loadDashboardLocationScopedData(
    db,
    orgId,
    selectedLocationId,
    weekStart,
    from,
    to
  );
}
