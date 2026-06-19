"use server";

import { revalidatePath } from "next/cache";
import type { Profile } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
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
    return profiles.sort((a, b) => a.sort_order - b.sort_order || a.full_name.localeCompare(b.full_name));
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
