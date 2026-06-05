"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import type { LocationAreaStaffing, ShiftType } from "@schichtwerk/types";

export type LocationStaffingActionResult =
  | {
      ok: true;
      shiftTypes?: ShiftType[];
      staffing?: LocationAreaStaffing[];
    }
  | { ok: false; error: string };

export async function fetchLocationStaffingEditor(
  locationId: string,
  locationAreaId: string | null
): Promise<LocationStaffingActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const locations = await db.listLocations(organizationId);
    if (!locations.some((l) => l.id === locationId)) {
      return { ok: false, error: "Standort nicht gefunden" };
    }

    const shiftTypes = await db.listShiftTypes(organizationId);
    let staffing: LocationAreaStaffing[] = [];
    if (locationAreaId) {
      staffing = await db.listLocationAreaStaffingForArea(
        locationAreaId,
        locationId
      );
    }

    return { ok: true, shiftTypes, staffing };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function saveLocationAreaStaffing(input: {
  locationId: string;
  locationAreaId: string;
  rules: { shift_type_id: string; weekday: number; required_count: number }[];
}): Promise<LocationStaffingActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const locations = await db.listLocations(organizationId);
    if (!locations.some((l) => l.id === input.locationId)) {
      return { ok: false, error: "Standort nicht gefunden" };
    }

    for (const r of input.rules) {
      if (r.weekday < 0 || r.weekday > 6) {
        return { ok: false, error: "Ungültiger Wochentag" };
      }
      if (r.required_count < 0 || r.required_count > 99) {
        return { ok: false, error: "Anzahl muss zwischen 0 und 99 liegen" };
      }
    }

    await db.replaceLocationAreaStaffing(
      input.locationAreaId,
      input.locationId,
      input.rules
    );

    revalidatePath("/dashboard");
    const staffing = await db.listLocationAreaStaffingForArea(
      input.locationAreaId,
      input.locationId
    );
    return { ok: true, staffing };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}
