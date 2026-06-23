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
