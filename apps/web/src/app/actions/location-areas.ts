"use server";

import { revalidatePath } from "next/cache";
import {
  validateLocationAreaName,
  validateLocationAreaUniqueness,
} from "@schichtwerk/database";
import type { LocationArea } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type LocationAreaActionResult =
  | { ok: true; id?: string; areas?: LocationArea[] }
  | { ok: false; error: string };

export async function fetchLocationAreas(
  locationId: string
): Promise<LocationAreaActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const locations = await db.listLocations(organizationId);
    if (!locations.some((l) => l.id === locationId)) {
      return { ok: false, error: "Standort nicht gefunden" };
    }
    const areas = await db.listLocationAreas(locationId);
    return { ok: true, areas };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function createLocationArea(input: {
  locationId: string;
  name: string;
}): Promise<LocationAreaActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const locations = await db.listLocations(organizationId);
    if (!locations.some((l) => l.id === input.locationId)) {
      return { ok: false, error: "Standort nicht gefunden" };
    }

    const nameCheck = validateLocationAreaName(input.name);
    if (!nameCheck.ok) return nameCheck;

    const existing = await db.listLocationAreas(input.locationId);
    const unique = validateLocationAreaUniqueness(existing, {
      name: nameCheck.value,
    });
    if (!unique.ok) return unique;

    const sortOrder = await db.getNextLocationAreaSortOrder(input.locationId);
    const created = await db.insertLocationArea({
      location_id: input.locationId,
      name: nameCheck.value,
      sort_order: sortOrder,
    });

    revalidatePath("/dashboard");
    const areas = await db.listLocationAreas(input.locationId);
    return { ok: true, id: created.id, areas };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function updateLocationArea(input: {
  id: string;
  locationId: string;
  name: string;
}): Promise<LocationAreaActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const locations = await db.listLocations(organizationId);
    if (!locations.some((l) => l.id === input.locationId)) {
      return { ok: false, error: "Standort nicht gefunden" };
    }

    const nameCheck = validateLocationAreaName(input.name);
    if (!nameCheck.ok) return nameCheck;

    const existing = await db.listLocationAreas(input.locationId);
    const unique = validateLocationAreaUniqueness(existing, {
      name: nameCheck.value,
      excludeId: input.id,
    });
    if (!unique.ok) return unique;

    await db.updateLocationArea(input.id, input.locationId, {
      name: nameCheck.value,
    });

    revalidatePath("/dashboard");
    const areas = await db.listLocationAreas(input.locationId);
    return { ok: true, id: input.id, areas };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

/** Aus Liste entfernen; Daten bleiben für Schichten und spätere Kostenauswertung erhalten. */
export async function archiveLocationArea(input: {
  id: string;
  locationId: string;
}): Promise<LocationAreaActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const locations = await db.listLocations(organizationId);
    if (!locations.some((l) => l.id === input.locationId)) {
      return { ok: false, error: "Standort nicht gefunden" };
    }

    await db.archiveLocationArea(input.id, input.locationId);
    revalidatePath("/dashboard");
    const areas = await db.listLocationAreas(input.locationId);
    return { ok: true, areas };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Archivieren fehlgeschlagen",
    };
  }
}
