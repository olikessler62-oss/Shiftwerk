"use server";

import type {
  Location,
  LocationArea,
  Profile,
  ProfileRecurringAvailability,
  ProfileShiftPreference,
  Qualification,
} from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type FetchOverviewShiftPreferencesResult =
  | {
      ok: true;
      profiles: Profile[];
      preferences: ProfileShiftPreference[];
      availability: ProfileRecurringAvailability[];
      locations: Location[];
      areas: LocationArea[];
      qualifications: Qualification[];
    }
  | { ok: false; error: string };

export async function fetchOverviewShiftPreferences(): Promise<FetchOverviewShiftPreferencesResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const [orgProfiles, preferences, availability, locations, qualifications] =
      await Promise.all([
        db.listOrganizationProfiles(organizationId),
        db.listAllOrganizationShiftPreferences(organizationId),
        db.listOrganizationRecurringAvailability(organizationId),
        db.listLocations(organizationId),
        db.listQualifications(organizationId),
      ]);

    const profileById = new Map(orgProfiles.map((profile) => [profile.id, profile]));
    for (const preference of preferences) {
      if (profileById.has(preference.profile_id)) continue;
      const profile = await db.getProfileById(preference.profile_id);
      if (profile?.organization_id === organizationId) {
        profileById.set(profile.id, profile);
      }
    }

    const areaGroups = await Promise.all(
      locations.map((location) => db.listLocationAreas(location.id))
    );

    const profiles = [...profileById.values()].sort((a, b) => {
      const byName = a.full_name.localeCompare(b.full_name, "de");
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });

    return {
      ok: true,
      profiles,
      preferences,
      availability,
      locations,
      areas: areaGroups.flat(),
      qualifications,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Laden fehlgeschlagen",
    };
  }
}
