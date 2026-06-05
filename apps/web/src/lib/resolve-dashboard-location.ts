import type { Location } from "@schichtwerk/types";

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
