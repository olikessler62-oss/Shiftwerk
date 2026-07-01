import { getDatabase } from "@/lib/db";
import { getOrgFeatures, type OrgFeatures } from "@/lib/org-features";
import type { Organization, Profile, RolePermissionLevel } from "@schichtwerk/types";
import { getManagerSession } from "@/lib/server-manager-session";

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
    show_compensation_in_planning_ui: true,
    shift_confirmation_enabled: false,
    auto_approve_sick_absence: true,
    shift_confirmation_disclaimer: null,
    shift_confirmation_pending_after_minutes: 180,
    created_at: new Date().toISOString(),
  };
}

export async function requireManager(): Promise<ManagerContext> {
  const session = await getManagerSession();

  if (!session) {
    throw new Error("Nicht angemeldet");
  }

  if (!MANAGER_ROLES.includes(session.profile.role)) {
    throw new Error("Keine Berechtigung");
  }

  return {
    userId: session.user.id,
    profile: session.profile,
    organizationId: session.organizationId,
    organization: session.organization,
    orgFeatures: session.orgFeatures,
  };
}

export async function requireAdmin(): Promise<ManagerContext> {
  const ctx = await requireManager();
  if (ctx.profile.role !== "admin") {
    throw new Error("Keine Berechtigung");
  }
  return ctx;
}
