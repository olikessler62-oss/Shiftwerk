"use server";

import { revalidatePath } from "next/cache";
import {
  slugifyRoleKey,
  validateRoleArchive,
  validateRoleUniqueness,
  isValidPermissionLevel,
} from "@schichtwerk/database";
import type { RolePermissionLevel } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type RoleActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function createRole(input: {
  name: string;
  permission_level: RolePermissionLevel;
}): Promise<RoleActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    if (!isValidPermissionLevel(input.permission_level)) {
      return { ok: false, error: "Ungültige Berechtigungsstufe." };
    }

    const existing = await db.listRoles(organizationId);
    const key = slugifyRoleKey(input.name);
    const unique = validateRoleUniqueness(existing, {
      name: input.name,
      key,
    });
    if (!unique.ok) return unique;

    const sortOrder = await db.getNextRoleSortOrder(organizationId);
    const created = await db.insertRole({
      organization_id: organizationId,
      key,
      name: input.name.trim(),
      permission_level: input.permission_level,
      sort_order: sortOrder,
    });

    revalidatePath("/dashboard");
    return { ok: true, id: created.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function updateRole(input: {
  id: string;
  name: string;
  permission_level?: RolePermissionLevel;
}): Promise<RoleActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const existing = await db.listRoles(organizationId);
    const current = existing.find((r) => r.id === input.id);
    if (!current) {
      return { ok: false, error: "Rolle nicht gefunden." };
    }

    const unique = validateRoleUniqueness(existing, {
      name: input.name,
      excludeId: input.id,
    });
    if (!unique.ok) return unique;

    const permissionLevel =
      current.is_system
        ? current.permission_level
        : input.permission_level && isValidPermissionLevel(input.permission_level)
          ? input.permission_level
          : current.permission_level;

    await db.updateRole(input.id, organizationId, {
      name: input.name.trim(),
      permission_level: permissionLevel,
    });

    revalidatePath("/dashboard");
    return { ok: true, id: input.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function deleteRole(id: string): Promise<RoleActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const existing = await db.listRoles(organizationId);
    const current = existing.find((r) => r.id === id);
    if (!current) {
      return { ok: false, error: "Rolle nicht gefunden." };
    }

    const archiveCheck = validateRoleArchive(current);
    if (!archiveCheck.ok) return archiveCheck;

    const inUse = await db.countProfilesUsingRole(id, organizationId);
    if (inUse > 0) {
      return {
        ok: false,
        error: "Rolle ist noch Benutzern zugewiesen und kann nicht archiviert werden.",
      };
    }

    await db.archiveRole(id, organizationId);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Archivieren fehlgeschlagen",
    };
  }
}
