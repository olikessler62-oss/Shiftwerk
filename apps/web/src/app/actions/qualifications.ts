"use server";

import { revalidatePath } from "next/cache";
import {
  validateQualificationArchive,
  validateQualificationUniqueness,
} from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type QualificationActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function createQualification(input: {
  name: string;
}): Promise<QualificationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const existing = await db.listQualifications(organizationId);
    const unique = validateQualificationUniqueness(existing, {
      name: input.name,
    });
    if (!unique.ok) return unique;

    const sortOrder = await db.getNextQualificationSortOrder(organizationId);
    const created = await db.insertQualification({
      organization_id: organizationId,
      name: input.name.trim(),
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

export async function updateQualification(input: {
  id: string;
  name: string;
}): Promise<QualificationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const existing = await db.listQualifications(organizationId);
    const unique = validateQualificationUniqueness(existing, {
      name: input.name,
      excludeId: input.id,
    });
    if (!unique.ok) return unique;

    await db.updateQualification(input.id, organizationId, {
      name: input.name.trim(),
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

export async function reorderQualifications(
  orderedIds: string[]
): Promise<QualificationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.reorderQualifications(organizationId, orderedIds);
    revalidatePath("/einstellungen");
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Reihenfolge konnte nicht gespeichert werden",
    };
  }
}

export async function deleteQualification(id: string): Promise<QualificationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const today = new Date().toISOString().slice(0, 10);
    const upcomingShiftCount =
      await db.countUpcomingShiftsForQualificationProfiles(
        organizationId,
        id,
        today
      );
    const archiveCheck = validateQualificationArchive(upcomingShiftCount);
    if (!archiveCheck.ok) return archiveCheck;

    await db.archiveQualification(id, organizationId);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Archivieren fehlgeschlagen",
    };
  }
}
