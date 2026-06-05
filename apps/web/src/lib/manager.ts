import { getDatabase } from "@/lib/db";
import type { Profile, RolePermissionLevel } from "@schichtwerk/types";

const MANAGER_ROLES: RolePermissionLevel[] = ["admin", "manager"];

export type ManagerContext = {
  userId: string;
  profile: Profile;
  organizationId: string;
};

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

  return {
    userId: user.id,
    profile,
    organizationId: profile.organization_id,
  };
}
