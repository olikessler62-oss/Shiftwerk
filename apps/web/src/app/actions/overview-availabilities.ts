"use server";

import type { Profile, ProfileRecurringAvailability } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type FetchOverviewAvailabilitiesResult =
  | { ok: true; profiles: Profile[]; availability: ProfileRecurringAvailability[] }
  | { ok: false; error: string };

export async function fetchOverviewAvailabilities(): Promise<FetchOverviewAvailabilitiesResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const [orgProfiles, availability] = await Promise.all([
      db.listOrganizationProfiles(organizationId),
      db.listOrganizationRecurringAvailability(organizationId),
    ]);

    const profileById = new Map(orgProfiles.map((profile) => [profile.id, profile]));
    for (const slot of availability) {
      if (profileById.has(slot.profile_id)) continue;
      const profile = await db.getProfileById(slot.profile_id);
      if (profile?.organization_id === organizationId) {
        profileById.set(profile.id, profile);
      }
    }

    const profiles = [...profileById.values()].sort((a, b) => {
      const byName = a.full_name.localeCompare(b.full_name, "de");
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });

    return { ok: true, profiles, availability };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Laden fehlgeschlagen",
    };
  }
}
