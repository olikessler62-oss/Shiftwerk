import { getDatabase } from "@/lib/db";
import { requireManager, type ManagerContext } from "@/lib/manager";

function parseSuperadminEmails(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Liest SUPERADMIN_EMAILS bei jedem Aufruf — wichtig für Vercel Runtime-Env. */
function getSuperadminEmailAllowlist(): Set<string> {
  return parseSuperadminEmails(process.env.SUPERADMIN_EMAILS);
}

export function isSuperadminDeveloperEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  const allowlist = getSuperadminEmailAllowlist();
  if (allowlist.size === 0) return false;
  return allowlist.has(email.trim().toLowerCase());
}

export function isSuperadminDeveloperForEmails(
  emails: (string | null | undefined)[]
): boolean {
  const allowlist = getSuperadminEmailAllowlist();
  if (allowlist.size === 0) return false;
  return emails.some(
    (email) => email && allowlist.has(email.trim().toLowerCase())
  );
}

export async function requireSuperadminDeveloper(): Promise<ManagerContext> {
  const ctx = await requireManager();
  const db = await getDatabase();
  const authUser = await db.authGetUser();

  if (!isSuperadminDeveloperForEmails([ctx.profile.email, authUser?.email])) {
    throw new Error("Keine Berechtigung");
  }

  return ctx;
}
