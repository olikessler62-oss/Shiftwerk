"use server";

import type { Profile } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type FetchOverviewAbsencesProfilesResult =
  | { ok: true; profiles: Profile[] }
  | { ok: false; error: string };

export async function fetchOverviewAbsencesProfiles(): Promise<FetchOverviewAbsencesProfilesResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profiles = await db.listOrganizationProfiles(organizationId);
    return { ok: true, profiles };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Laden fehlgeschlagen",
    };
  }
}
