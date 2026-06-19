"use server";

import type { Profile, ProfileHourlyRate } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type FetchOverviewCompensationResult =
  | {
      ok: true;
      profiles: Profile[];
      rates: ProfileHourlyRate[];
      serverToday: string;
    }
  | { ok: false; error: string };

export async function fetchOverviewCompensation(): Promise<FetchOverviewCompensationResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const [orgProfiles, rates, serverToday] = await Promise.all([
      db.listOrganizationProfiles(organizationId),
      db.listAllOrganizationProfileHourlyRates(organizationId),
      db.getServerDateIso(),
    ]);

    const profileById = new Map(orgProfiles.map((profile) => [profile.id, profile]));
    for (const rate of rates) {
      if (profileById.has(rate.profile_id)) continue;
      const profile = await db.getProfileById(rate.profile_id);
      if (profile?.organization_id === organizationId) {
        profileById.set(profile.id, profile);
      }
    }

    const profiles = [...profileById.values()].sort((a, b) => {
      const byName = a.full_name.localeCompare(b.full_name, "de");
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });

    return { ok: true, profiles, rates, serverToday };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Laden fehlgeschlagen",
    };
  }
}
