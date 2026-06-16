"use server";

import { getAdminDatabase } from "@/lib/db";
import { requireSuperadminDeveloper } from "@/lib/superadmin-access";
import { signOut } from "@/app/actions/sign-out";

export type DbResetActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function resetOrganizationDatabase(): Promise<DbResetActionResult> {
  try {
    const { organizationId, profile } = await requireSuperadminDeveloper();
    if (profile.role !== "admin") {
      return { ok: false, error: "Keine Berechtigung" };
    }
    const admin = getAdminDatabase();
    await admin.resetOrganizationOperationalData(organizationId);
    await signOut();
    return { ok: true };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Datenbank-Reset fehlgeschlagen",
    };
  }
}
