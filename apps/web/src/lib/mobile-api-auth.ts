import { createDatabase } from "@schichtwerk/database";
import { createClientWithAccessToken } from "@/lib/supabase/access-token";
import { createAdminClient } from "@/lib/supabase/admin";

export class MobileApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

function readBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

export async function requireMobileApiEmployee(request: Request) {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    throw new MobileApiError(401, "Unauthorized");
  }

  const db = createDatabase(createClientWithAccessToken(accessToken));
  const user = await db.authGetUser();
  if (!user) {
    throw new MobileApiError(401, "Unauthorized");
  }

  const profile = await db.getProfileById(user.id);
  if (!profile) {
    throw new MobileApiError(403, "Profil nicht gefunden.");
  }

  const organization = await db.getOrganization(profile.organization_id);
  if (!organization) {
    throw new MobileApiError(403, "Organisation nicht gefunden.");
  }

  if (!organization.shift_confirmation_enabled) {
    throw new MobileApiError(403, "Schichtbestätigung ist für diese Organisation nicht aktiv.");
  }

  return {
    userId: user.id,
    profile,
    organization,
    db,
    adminDb: createDatabase(createAdminClient()),
  };
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
