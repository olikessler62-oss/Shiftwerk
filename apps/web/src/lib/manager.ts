import { getDatabase } from "@/lib/db";
import { getOrgFeatures, type OrgFeatures } from "@/lib/org-features";
import type { Organization, Profile, RolePermissionLevel } from "@schichtwerk/types";

const MANAGER_ROLES: RolePermissionLevel[] = ["admin", "manager"];

export type ManagerContext = {
  userId: string;
  profile: Profile;
  organizationId: string;
  organization: Organization;
  orgFeatures: OrgFeatures;
};

/** Bestandsorganisationen ohne DB-Eintrag: advanced, damit nichts verschwindet. */
export async function loadManagerOrganization(
  organizationId: string,
  fallbackName?: string | null
): Promise<Organization> {
  const db = await getDatabase();
  const organization = await db.getOrganization(organizationId);
  if (organization) return organization;

  return {
    id: organizationId,
    name: fallbackName ?? "",
    timezone: "Europe/Berlin",
    country_code: "DE",
    planning_mode: "advanced",
    industry: null,
    allow_retroactive_compensation_entries: true,
    shift_confirmation_enabled: false,
    shift_confirmation_disclaimer: null,
    created_at: new Date().toISOString(),
  };
}

export async function requireManager(): Promise<ManagerContext> {
  const db = await getDatabase();
  const user = await db.authGetUser();

  if (!user) {
    throw new Error("Nicht angemeldet");
  }

  const profile = await db.getManagerProfile(user.id);

  if (!profile) {
    throw new Error("Profil nicht gefunden");
  }

  if (!MANAGER_ROLES.includes(profile.role)) {
    throw new Error("Keine Berechtigung");
  }

  const orgName = await db.getOrganizationName(profile.organization_id);
  const organization = await loadManagerOrganization(
    profile.organization_id,
    orgName
  );

  return {
    userId: user.id,
    profile,
    organizationId: profile.organization_id,
    organization,
    orgFeatures: getOrgFeatures(organization),
  };
}
