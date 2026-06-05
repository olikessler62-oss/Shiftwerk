"use server";

import { revalidatePath } from "next/cache";
import {
  validateShiftTypeBreaks,
  validateShiftTypeCount,
  validateShiftTypeUniqueness,
} from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import type { ShiftTypeBreakInput } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type ShiftTypeActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export type { ShiftTypeBreakInput };

export async function createShiftType(input: {
  name: string;
  start_time: string;
  end_time: string;
  color?: string;
  breaks: ShiftTypeBreakInput[];
}): Promise<ShiftTypeActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const existing = await db.listShiftTypes(organizationId);
    const countCheck = validateShiftTypeCount(existing.length, true);
    if (!countCheck.ok) return countCheck;

    const unique = validateShiftTypeUniqueness(existing, {
      name: input.name,
      start_time: input.start_time,
      end_time: input.end_time,
    });
    if (!unique.ok) return unique;

    const breaksCheck = validateShiftTypeBreaks(
      input.start_time,
      input.end_time,
      input.breaks
    );
    if (!breaksCheck.ok) return breaksCheck;

    const sortOrder = await db.getNextShiftTypeSortOrder(organizationId);

    const created = await db.insertShiftType({
      organization_id: organizationId,
      name: input.name.trim(),
      start_time: input.start_time,
      end_time: input.end_time,
      color: input.color ?? "#64748b",
      sort_order: sortOrder,
    });

    await db.replaceShiftTypeBreaks(created.id, input.breaks);
    revalidatePath("/einstellungen");
    revalidatePath("/dashboard");
    return { ok: true, id: created.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function updateShiftType(input: {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  breaks: ShiftTypeBreakInput[];
}): Promise<ShiftTypeActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const existing = await db.listShiftTypes(organizationId);
    const unique = validateShiftTypeUniqueness(existing, {
      name: input.name,
      start_time: input.start_time,
      end_time: input.end_time,
      excludeId: input.id,
    });
    if (!unique.ok) return unique;

    const breaksCheck = validateShiftTypeBreaks(
      input.start_time,
      input.end_time,
      input.breaks
    );
    if (!breaksCheck.ok) return breaksCheck;

    await db.updateShiftType(input.id, organizationId, {
      name: input.name.trim(),
      start_time: input.start_time,
      end_time: input.end_time,
    });

    await db.replaceShiftTypeBreaks(input.id, input.breaks);
    revalidatePath("/einstellungen");
    revalidatePath("/dashboard");
    return { ok: true, id: input.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

/** Aus Einstellungsliste entfernen; bestehende Schichten behalten die Schichtart für Historie. */
export async function deleteShiftType(id: string): Promise<ShiftTypeActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.archiveShiftType(id, organizationId);
    revalidatePath("/einstellungen");
    revalidatePath("/dashboard");
    revalidatePath("/planung");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Archivieren fehlgeschlagen",
    };
  }
}
