"use server";

import type { AbsenceRequest, Profile } from "@schichtwerk/types";
import { fetchOrganizationAbsences } from "@/app/actions/absences";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type FetchOverviewAbsencesResult =
  | { ok: true; profiles: Profile[]; absences: AbsenceRequest[] }
  | { ok: false; error: string };

export async function fetchOverviewAbsences(): Promise<FetchOverviewAbsencesResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const [orgProfiles, absencesResult] = await Promise.all([
      db.listOrganizationProfiles(organizationId),
      fetchOrganizationAbsences(),
    ]);

    if (!absencesResult.ok) {
      return absencesResult;
    }

    const profileById = new Map(orgProfiles.map((profile) => [profile.id, profile]));
    for (const absence of absencesResult.absences) {
      if (profileById.has(absence.employee_id)) continue;
      const profile = await db.getProfileById(absence.employee_id);
      if (profile?.organization_id === organizationId) {
        profileById.set(profile.id, profile);
      }
    }

    const profiles = [...profileById.values()].sort((a, b) => {
      const byName = a.full_name.localeCompare(b.full_name, "de");
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });

    return { ok: true, profiles, absences: absencesResult.absences };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Laden fehlgeschlagen",
    };
  }
}
