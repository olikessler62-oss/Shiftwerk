"use server";

import { revalidatePath } from "next/cache";
import { validateOrganizationPlanningModeUpgrade } from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import { organizationPlanningModeErrorKey } from "@/lib/translate-action-error";

export type OrganizationActionResult =
  | { ok: true }
  | { ok: false; errorKey: string };

export async function upgradeOrganizationPlanningMode(): Promise<OrganizationActionResult> {
  try {
    const { organizationId, organization } = await requireManager();
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
    revalidatePath("/planung", "layout");
    revalidatePath("/team", "layout");
    revalidatePath("/berichte", "layout");

    return { ok: true };
  } catch {
    return { ok: false, errorKey: "organization.errors.saveFailed" };
  }
}
