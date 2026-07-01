"use server";

import { revalidatePath } from "next/cache";
import {
  isValidShiftConfirmationPendingAfterMinutes,
  validateOrganizationPlanningModeUpgrade,
} from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import { requireSuperadminDeveloper } from "@/lib/superadmin-access";
import { ORGANIZATION_MIGRATION_SHOW_COMPENSATION_IN_PLANNING_UI } from "@schichtwerk/database";
import { organizationPlanningModeErrorKey } from "@/lib/translate-action-error";

export type OrganizationActionResult =
  | { ok: true }
  | { ok: false; errorKey: string };

function revalidateOrganizationDependentPaths() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/bereich-kalender", "layout");
  revalidatePath("/mitarbeiter-kalender", "layout");
  revalidatePath("/team", "layout");
  revalidatePath("/berichte", "layout");
  revalidatePath("/settings", "layout");
}

export async function updateOrganizationName(
  name: string
): Promise<OrganizationActionResult> {
  try {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 30) {
      return { ok: false, errorKey: "organization.errors.invalidName" };
    }

    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.updateOrganizationName(organizationId, trimmed);

    revalidateOrganizationDependentPaths();

    return { ok: true };
  } catch {
    return { ok: false, errorKey: "organization.errors.saveFailed" };
  }
}

export async function updateOrganizationShiftConfirmationPendingAfterMinutes(
  minutes: number
): Promise<OrganizationActionResult> {
  try {
    if (!isValidShiftConfirmationPendingAfterMinutes(minutes)) {
      return {
        ok: false,
        errorKey: "organization.errors.invalidShiftConfirmationPendingAfter",
      };
    }

    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.updateOrganizationShiftConfirmationPendingAfterMinutes(
      organizationId,
      minutes
    );

    revalidateOrganizationDependentPaths();

    return { ok: true };
  } catch {
    return { ok: false, errorKey: "organization.errors.saveFailed" };
  }
}

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

    revalidateOrganizationDependentPaths();

    return { ok: true };
  } catch {
    return { ok: false, errorKey: "organization.errors.saveFailed" };
  }
}

export async function updateOrganizationShowCompensationInPlanningUi(
  enabled: boolean
): Promise<OrganizationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.updateOrganizationShowCompensationInPlanningUi(
      organizationId,
      enabled
    );

    revalidatePath("/dashboard", "layout");
    revalidatePath("/bereich-kalender", "layout");
    revalidatePath("/mitarbeiter-kalender", "layout");

    return { ok: true };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === ORGANIZATION_MIGRATION_SHOW_COMPENSATION_IN_PLANNING_UI
    ) {
      return {
        ok: false,
        errorKey: "organization.errors.migrationShowCompensationInPlanningUi",
      };
    }
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
