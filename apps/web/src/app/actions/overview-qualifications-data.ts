"use server";

import type { Profile, Qualification } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import type { OverviewProfileQualificationAssignment } from "@/lib/overview-qualifications-display";

export type FetchOverviewQualificationsResult =
  | {
      ok: true;
      profiles: Profile[];
      assignments: OverviewProfileQualificationAssignment[];
      qualifications: Qualification[];
    }
  | { ok: false; error: string };

export async function fetchOverviewQualifications(): Promise<FetchOverviewQualificationsResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const [profiles, qualifications, assignmentMap] = await Promise.all([
      db.listOrganizationProfiles(organizationId),
      db.listQualifications(organizationId),
      db.listProfileQualificationIdsByOrganization(organizationId),
    ]);

    const qualificationById = new Map(
      qualifications.map((qualification) => [qualification.id, qualification])
    );

    const assignments: OverviewProfileQualificationAssignment[] = [];
    for (const [profileId, qualificationIds] of assignmentMap) {
      for (const qualificationId of qualificationIds) {
        const qualification = qualificationById.get(qualificationId);
        if (!qualification) continue;
        assignments.push({ profile_id: profileId, qualification });
      }
    }

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    for (const assignment of assignments) {
      if (profileById.has(assignment.profile_id)) continue;
      const profile = await db.getProfileById(assignment.profile_id);
      if (profile?.organization_id === organizationId) {
        profileById.set(profile.id, profile);
      }
    }

    const sortedProfiles = [...profileById.values()].sort((a, b) => {
      const byName = a.full_name.localeCompare(b.full_name, "de");
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });

    return {
      ok: true,
      profiles: sortedProfiles,
      assignments,
      qualifications,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Laden fehlgeschlagen",
    };
  }
}
