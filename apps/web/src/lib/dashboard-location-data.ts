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

function uniqueServiceHoursById(
  serviceHours: readonly AreaServiceHourRef[]
): AreaServiceHourRef[] {
  const seen = new Set<string>();
  const result: AreaServiceHourRef[] = [];
  for (const hour of serviceHours) {
    const id = hour.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(hour);
  }
  return result;
}

function uniqueStaffingRulesById(
  rules: readonly LocationAreaStaffing[]
): LocationAreaStaffing[] {
  const seen = new Set<string>();
  const result: LocationAreaStaffing[] = [];
  for (const rule of rules) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    result.push(rule);
  }
  return result;
}

export async function loadDashboardLocationScopedData(
  db: SchichtwerkDatabase,
  orgId: string,
  locationId: string,
  weekStart: string,
  from: string,
  to: string
): Promise<DashboardLocationScopedData> {
  const areas = await db.listLocationAreasForAreaCalendar(
    locationId,
    from,
    to
  );
  const calendarAreaIds = areas.map((area) => area.id);

  const activeAreas = await db.listLocationAreas(locationId);
  const activeAreaIds = new Set(activeAreas.map((area) => area.id));
  const supplementalAreaIds = calendarAreaIds.filter(
    (areaId) => !activeAreaIds.has(areaId)
  );

  const [
    areaShiftTemplates,
    serviceHoursBase,
    shiftRows,
    staffingRulesBase,
    staffingOverrides,
    supplementalServiceHours,
    supplementalStaffingRules,
  ] = await Promise.all([
    db.listAreaShiftTemplatesWithBreaksForLocation(locationId).catch(() => []),
    db.listLocationAreaServiceHours(locationId).catch(() => []),
    getCachedAreaCalendarShifts(orgId, locationId, weekStart, from, to),
    db.listLocationAreaStaffing(locationId).catch(() => []),
    db.listLocationAreaStaffingOverrides(locationId, from, to).catch(() => []),
    supplementalAreaIds.length
      ? db
          .listLocationAreaServiceHoursForAreas(supplementalAreaIds)
          .catch(() => [])
      : Promise.resolve([] as AreaServiceHourRef[]),
    supplementalAreaIds.length
      ? db
          .listLocationAreaStaffingForAreas(supplementalAreaIds)
          .catch(() => [])
      : Promise.resolve([] as LocationAreaStaffing[]),
  ]);

  return {
    areas,
    areaShiftTemplates,
    serviceHours: uniqueServiceHoursById([
      ...serviceHoursBase,
      ...supplementalServiceHours,
    ]),
    shiftRows,
    staffingRules: uniqueStaffingRulesById([
      ...staffingRulesBase,
      ...supplementalStaffingRules,
    ]),
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
