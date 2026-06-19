"use server";

import type {
  CompensationSurchargeType,
  Profile,
  ProfileCompensationSurcharge,
  ProfileHourlyRate,
} from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type FetchOverviewSurchargesResult =
  | {
      ok: true;
      profiles: Profile[];
      surcharges: ProfileCompensationSurcharge[];
      rates: ProfileHourlyRate[];
      surchargeTypes: CompensationSurchargeType[];
      serverToday: string;
    }
  | { ok: false; error: string };

export async function fetchOverviewSurcharges(): Promise<FetchOverviewSurchargesResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const [orgProfiles, surcharges, rates, surchargeTypes, serverToday] =
      await Promise.all([
        db.listOrganizationProfiles(organizationId),
        db.listAllOrganizationProfileCompensationSurcharges(organizationId),
        db.listAllOrganizationProfileHourlyRates(organizationId),
        db.listCompensationSurchargeTypes(organizationId),
        db.getServerDateIso(),
      ]);

    const profileById = new Map(orgProfiles.map((profile) => [profile.id, profile]));
    for (const entry of surcharges) {
      if (profileById.has(entry.profile_id)) continue;
      const profile = await db.getProfileById(entry.profile_id);
      if (profile?.organization_id === organizationId) {
        profileById.set(profile.id, profile);
      }
    }

    const profiles = [...profileById.values()].sort((a, b) => {
      const byName = a.full_name.localeCompare(b.full_name, "de");
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });

    return {
      ok: true,
      profiles,
      surcharges,
      rates,
      surchargeTypes,
      serverToday,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Laden fehlgeschlagen",
    };
  }
}
