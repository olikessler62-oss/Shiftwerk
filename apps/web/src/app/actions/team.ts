"use server";

import { revalidatePath } from "next/cache";
import { validateProfileFullNameUniqueness } from "@schichtwerk/database";
import { getPublicSiteUrl } from "@/lib/auth-callback";
import { getAdminDatabase, getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

const MAX_EMPLOYEES = 20;

export type TeamActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function inviteEmployee(
  _prev: TeamActionResult | null,
  formData: FormData
): Promise<TeamActionResult> {
  try {
    const { organizationId } = await requireManager();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    if (!fullName || !email) {
      return { ok: false, error: "Name und E-Mail sind Pflicht." };
    }

    const db = await getDatabase();
    const admin = getAdminDatabase();

    const count = await db.countActiveEmployees(organizationId);

    if (count >= MAX_EMPLOYEES) {
      return {
        ok: false,
        error: `Maximal ${MAX_EMPLOYEES} aktives Personal erlaubt.`,
      };
    }

    const existing = await db.findProfileByEmail(organizationId, email);

    if (existing) {
      return { ok: false, error: "Diese E-Mail ist bereits im Team." };
    }

    const profiles = await db.listOrganizationProfiles(organizationId);
    const nameCheck = validateProfileFullNameUniqueness(profiles, {
      full_name: fullName,
    });
    if (!nameCheck.ok) return nameCheck;

    const siteUrl = getPublicSiteUrl();

    const { data: invited, error: inviteError } = await admin.authInviteUserByEmail(
      email,
      {
        full_name: fullName,
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
      }
    );

    if (inviteError || !invited) {
      return {
        ok: false,
        error: inviteError ?? "Einladung fehlgeschlagen",
      };
    }

    try {
      await admin.insertProfile({
        id: invited.user.id,
        organization_id: organizationId,
        role: "basic",
        full_name: fullName,
        email,
      });
    } catch (e) {
      await admin.authDeleteUser(invited.user.id);
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Profil fehlgeschlagen",
      };
    }

    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");

    return {
      ok: true,
      message: `Einladung an ${email} gesendet. Nachricht enthält Link zum Passwort setzen.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unbekannter Fehler",
    };
  }
}
