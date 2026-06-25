import type { Location, LocationArea } from "@schichtwerk/types";

export function resolveSelectedLocationId(
  locations: Location[],
  locationParam: string | undefined
): string | null {
  if (locations.length === 0) return null;
  if (locationParam && locations.some((l) => l.id === locationParam)) {
    return locationParam;
  }
  return locations[0].id;
}

/** URL-Parameter oder Cookie-Fallback (wie in Planning-Shells). */
export function resolvePlanningLocationId(
  locations: Location[],
  locationParam: string | undefined,
  tentativeLocationId: string | undefined
): string | null {
  return resolveSelectedLocationId(
    locations,
    locationParam ?? tentativeLocationId
  );
}

export function resolveSelectedAreaId(
  areas: LocationArea[],
  areaParam: string | undefined
): string | null {
  if (areas.length === 0) return null;
  if (areaParam && areas.some((area) => area.id === areaParam)) {
    return areaParam;
  }
  return areas[0].id;
}

/** Bereich-Kalender: genau ein Bereich aktiv (URL-Parameter oder erster Bereich). */
export function resolveSingleActiveAreaIds(
  areas: readonly Pick<LocationArea, "id">[],
  preferredAreaId?: string | null
): Set<string> {
  if (
    preferredAreaId &&
    areas.some((area) => area.id === preferredAreaId)
  ) {
    return new Set([preferredAreaId]);
  }
  const firstAreaId = areas[0]?.id;
  return firstAreaId ? new Set([firstAreaId]) : new Set();
}

/** Standard-Bereich für Planungskalender: URL, dann aktiver Bereich mit Schichten, sonst erster aktiver Bereich. */
export function resolvePlanningAreaId(input: {
  calendarAreas: readonly LocationArea[];
  activeAreas: readonly LocationArea[];
  areaParam: string | undefined;
  shiftAreaIds: readonly (string | null | undefined)[];
}): string | null {
  const { calendarAreas, activeAreas, areaParam, shiftAreaIds } = input;

  if (areaParam && calendarAreas.some((area) => area.id === areaParam)) {
    return areaParam;
  }

  const activeIds = new Set(activeAreas.map((area) => area.id));
  const shiftIdsInWeek = [
    ...new Set(
      shiftAreaIds.filter((areaId): areaId is string => Boolean(areaId))
    ),
  ];

  for (const areaId of shiftIdsInWeek) {
    if (activeIds.has(areaId)) return areaId;
  }

  if (activeAreas[0]?.id) return activeAreas[0].id;
  return calendarAreas[0]?.id ?? null;
}
