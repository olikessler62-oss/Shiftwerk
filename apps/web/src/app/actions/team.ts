"use server";

import { revalidatePath } from "next/cache";
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
        error: `Maximal ${MAX_EMPLOYEES} aktive Mitarbeiter erlaubt.`,
      };
    }

    const existing = await db.findProfileByEmail(organizationId, email);

    if (existing) {
      return { ok: false, error: "Diese E-Mail ist bereits im Team." };
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const { data: invited, error: inviteError } = await admin.authInviteUserByEmail(
      email,
      {
        full_name: fullName,
        redirectTo: `${siteUrl}/auth/callback?next=/app-only`,
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

    revalidatePath("/planung");
    revalidatePath("/dashboard");

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
