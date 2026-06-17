import type {
  Location,
  LocationArea,
  ProfileShiftPreference,
  Qualification,
} from "@schichtwerk/types";

export type ShiftPreferencePlacementLookups = {
  locationNameById: ReadonlyMap<string, string>;
  areaById: ReadonlyMap<string, LocationArea>;
  qualificationNameById: ReadonlyMap<string, string>;
};

export function buildShiftPreferencePlacementLookups(input: {
  locations: readonly Location[];
  areas: readonly LocationArea[];
  qualifications: readonly Qualification[];
}): ShiftPreferencePlacementLookups {
  return {
    locationNameById: new Map(input.locations.map((location) => [location.id, location.name])),
    areaById: new Map(input.areas.map((area) => [area.id, area])),
    qualificationNameById: new Map(
      input.qualifications.map((qualification) => [qualification.id, qualification.name])
    ),
  };
}

export function resolveShiftPreferenceLocationId(
  preference: Pick<ProfileShiftPreference, "location_id" | "location_area_id">,
  lookups: ShiftPreferencePlacementLookups
): string | null {
  if (preference.location_id) return preference.location_id;
  if (!preference.location_area_id) return null;
  return lookups.areaById.get(preference.location_area_id)?.location_id ?? null;
}

export function formatShiftPreferenceLocationLabel(
  preference: Pick<ProfileShiftPreference, "location_id" | "location_area_id">,
  lookups: ShiftPreferencePlacementLookups,
  emptyLabel: string
): string {
  const locationId = resolveShiftPreferenceLocationId(preference, lookups);
  if (!locationId) return emptyLabel;
  return lookups.locationNameById.get(locationId) ?? emptyLabel;
}

export function formatShiftPreferenceAreaLabel(
  preference: Pick<ProfileShiftPreference, "location_area_id">,
  lookups: ShiftPreferencePlacementLookups,
  emptyLabel: string
): string {
  if (!preference.location_area_id) return emptyLabel;
  return lookups.areaById.get(preference.location_area_id)?.name ?? emptyLabel;
}

export function formatShiftPreferenceJobLabel(
  preference: Pick<ProfileShiftPreference, "qualification_id">,
  lookups: ShiftPreferencePlacementLookups,
  emptyLabel: string
): string {
  if (!preference.qualification_id) return emptyLabel;
  return (
    lookups.qualificationNameById.get(preference.qualification_id) ?? emptyLabel
  );
}
