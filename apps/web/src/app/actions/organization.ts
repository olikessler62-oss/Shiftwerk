"use server";

import { revalidatePath } from "next/cache";
import { validateOrganizationPlanningModeUpgrade } from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import { requireSuperadminDeveloper } from "@/lib/superadmin-access";
import { organizationPlanningModeErrorKey } from "@/lib/translate-action-error";

export type OrganizationActionResult =
  | { ok: true }
  | { ok: false; errorKey: string };

export async function updateOrganizationAllowRetroactiveCompensationEntries(
  allowed: boolean
): Promise<OrganizationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.updateOrganizationAllowRetroactiveCompensationEntries(
      organizationId,
      allowed
    );

    revalidatePath("/dashboard", "layout");
    revalidatePath("/bereich-kalender", "layout");
    revalidatePath("/team", "layout");
    revalidatePath("/berichte", "layout");

    return { ok: true };
  } catch {
    return { ok: false, errorKey: "organization.errors.saveFailed" };
  }
}

export async function updateOrganizationShiftConfirmationEnabled(
  enabled: boolean
): Promise<OrganizationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.updateOrganizationShiftConfirmationEnabled(organizationId, enabled);

    revalidatePath("/dashboard", "layout");
    revalidatePath("/bereich-kalender", "layout");
    revalidatePath("/team", "layout");
    revalidatePath("/berichte", "layout");

    return { ok: true };
  } catch {
    return { ok: false, errorKey: "organization.errors.saveFailed" };
  }
}

export async function updateOrganizationShiftConfirmationDisclaimer(
  disclaimer: string | null
): Promise<OrganizationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const normalized = disclaimer?.trim() ? disclaimer.trim() : null;
    await db.updateOrganizationShiftConfirmationDisclaimer(organizationId, normalized);

    revalidatePath("/dashboard", "layout");
    revalidatePath("/bereich-kalender", "layout");
    revalidatePath("/settings/notifications-outbox");

    return { ok: true };
  } catch {
    return { ok: false, errorKey: "organization.errors.saveFailed" };
  }
}

export async function upgradeOrganizationPlanningMode(): Promise<OrganizationActionResult> {
  try {
    const { organizationId, organization } = await requireSuperadminDeveloper();
    const upgradeCheck = validateOrganizationPlanningModeUpgrade(
      organization.planning_mode,
      "advanced"
    );
    if (!upgradeCheck.ok) {
      return {
        ok: false,
        errorKey: organizationPlanningModeErrorKey(upgradeCheck.code),
      };
    }

    const db = await getDatabase();
    await db.updateOrganizationPlanningMode(organizationId, "advanced");

    revalidatePath("/dashboard", "layout");
    revalidatePath("/bereich-kalender", "layout");
    revalidatePath("/team", "layout");
    revalidatePath("/berichte", "layout");

    return { ok: true };
  } catch {
    return { ok: false, errorKey: "organization.errors.saveFailed" };
  }
}
