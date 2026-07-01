import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import type { Organization, Profile } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { getOrgFeatures, type OrgFeatures } from "@/lib/org-features";
import { loadManagerOrganization } from "@/lib/manager";

export type ManagerSession = {
  user: User;
  profile: Profile;
  organizationId: string;
  organization: Organization;
  orgFeatures: OrgFeatures;
};

const loadCachedManagerOrganization = cache(loadManagerOrganization);

/** Session aus Cookies — Middleware validiert JWT; kein zweiter Auth-Server-Roundtrip. */
export const getServerAuthSession = cache(async () => {
  const db = await getDatabase();
  return db.authGetSession();
});

/** User per Server-JWT-Validierung (nicht nur Cookie-Session lesen). */
export const getServerAuthUser = cache(async () => {
  const db = await getDatabase();
  return db.authGetUser();
});

/**
 * Profil + Organisation einmal pro Request laden (Layout und Page teilen den Cache).
 */
export const getManagerSession = cache(async (): Promise<ManagerSession | null> => {
  const user = await getServerAuthUser();
  if (!user) return null;

  const db = await getDatabase();
  const profile = await db.getProfileById(user.id);
  if (!profile) return null;

  const organization = await loadCachedManagerOrganization(profile.organization_id);

  return {
    user,
    profile,
    organizationId: profile.organization_id,
    organization,
    orgFeatures: getOrgFeatures(organization),
  };
});
