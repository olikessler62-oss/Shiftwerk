"use server";

import { revalidatePath } from "next/cache";
import {
  validateLocationInput,
  validateLocationUniqueness,
} from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type LocationActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function createLocation(input: {
  name: string;
}): Promise<LocationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const validated = validateLocationInput(input);
    if (!validated.ok) return validated;

    const existing = await db.listLocations(organizationId);
    const unique = validateLocationUniqueness(existing, {
      name: validated.data.name,
    });
    if (!unique.ok) return unique;

    const sortOrder = await db.getNextLocationSortOrder(organizationId);
    const created = await db.insertLocation({
      organization_id: organizationId,
      name: validated.data.name,
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

export async function updateLocation(input: {
  id: string;
  name: string;
}): Promise<LocationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const validated = validateLocationInput(input);
    if (!validated.ok) return validated;

    const existing = await db.listLocations(organizationId);
    const unique = validateLocationUniqueness(existing, {
      name: validated.data.name,
      excludeId: input.id,
    });
    if (!unique.ok) return unique;

    await db.updateLocation(input.id, organizationId, validated.data);

    revalidatePath("/dashboard");
    return { ok: true, id: input.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function reorderLocations(
  orderedIds: string[]
): Promise<LocationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.reorderLocations(organizationId, orderedIds);
    revalidatePath("/einstellungen");
    revalidatePath("/dashboard");
    revalidatePath("/planung");
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

/** Standort und zugehörige Bereiche archivieren (kein Hard-Delete — Historie bleibt). */
export async function deleteLocation(id: string): Promise<LocationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.archiveLocation(id, organizationId);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Archivieren fehlgeschlagen",
    };
  }
}
