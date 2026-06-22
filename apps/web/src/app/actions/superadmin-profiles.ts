"use server";

import { revalidatePath } from "next/cache";
import type { Profile } from "@schichtwerk/types";
import { getAdminDatabase, getDatabase } from "@/lib/db";
import { requireSuperadminDeveloper } from "@/lib/superadmin-access";

export type SuperadminProfileActionResult =
  | { ok: true }
  | { ok: false; errorKey: string };

export async function listSuperadminProfiles(): Promise<
  Profile[] | { ok: false; errorKey: string }
> {
  try {
    const { organizationId } = await requireSuperadminDeveloper();
    const db = await getDatabase();
    const profiles = await db.listOrganizationProfiles(organizationId);
    return profiles.sort(
      (a, b) => a.sort_order - b.sort_order || a.full_name.localeCompare(b.full_name)
    );
  } catch {
    return { ok: false, errorKey: "superadmin.errors.loadProfilesFailed" };
  }
}

export async function updateSuperadminProfileSimulationSettings(input: {
  profileId: string;
  is_active: boolean;
  schedulable: boolean;
  app_registered: boolean;
  email_fallback_mode: boolean;
}): Promise<SuperadminProfileActionResult> {
  try {
    const { organizationId } = await requireSuperadminDeveloper();
    const db = await getDatabase();
    const existing = await db.getProfileById(input.profileId);
    if (!existing || existing.organization_id !== organizationId) {
      return { ok: false, errorKey: "superadmin.errors.profileNotFound" };
    }

    await db.updateProfileSuperadminSimulationSettings(input.profileId, organizationId, {
      is_active: input.is_active,
      schedulable: input.is_active ? input.schedulable : false,
      app_registered_at: input.app_registered ? new Date().toISOString() : null,
      email_fallback_mode: input.email_fallback_mode,
    });

    revalidatePath("/dashboard", "layout");
    revalidatePath("/bereich-kalender", "layout");
    revalidatePath("/team", "layout");

    return { ok: true };
  } catch {
    return { ok: false, errorKey: "superadmin.errors.saveProfileFailed" };
  }
}

export async function permanentlyDeleteSuperadminProfile(input: {
  profileId: string;
}): Promise<SuperadminProfileActionResult> {
  try {
    const ctx = await requireSuperadminDeveloper();
    if (input.profileId === ctx.profile.id) {
      return { ok: false, errorKey: "superadmin.errors.cannotDeleteSelf" };
    }

    const admin = getAdminDatabase();
    await admin.hardDeleteOrganizationProfile(ctx.organizationId, input.profileId);

    revalidatePath("/dashboard", "layout");
    revalidatePath("/bereich-kalender", "layout");
    revalidatePath("/team", "layout");
    revalidatePath("/einstellungen", "layout");

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Löschen fehlgeschlagen";
    if (message.includes("Profil nicht gefunden")) {
      return { ok: false, errorKey: "superadmin.errors.profileNotFound" };
    }
    return { ok: false, errorKey: "superadmin.errors.deleteProfileFailed" };
  }
}
