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

const superadminEmails = parseSuperadminEmails(process.env.SUPERADMIN_EMAILS);

export function isSuperadminDeveloperEmail(
  email: string | null | undefined
): boolean {
  if (!email || superadminEmails.size === 0) return false;
  return superadminEmails.has(email.trim().toLowerCase());
}

export async function requireSuperadminDeveloper(): Promise<ManagerContext> {
  const ctx = await requireManager();

  if (!isSuperadminDeveloperEmail(ctx.profile.email)) {
    throw new Error("Keine Berechtigung");
  }

  return ctx;
}
