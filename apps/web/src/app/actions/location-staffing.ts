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

async function assertLocationArea(
  organizationId: string,
  locationId: string,
  locationAreaId: string
) {
  const db = await getDatabase();
  const locations = await db.listLocations(organizationId);
  if (!locations.some((l) => l.id === locationId)) {
    return { ok: false as const, error: "Standort nicht gefunden" };
  }
  const areas = await db.listLocationAreas(locationId);
  if (!areas.some((a) => a.id === locationAreaId)) {
    return { ok: false as const, error: "Bereich nicht gefunden" };
  }
  return { ok: true as const, db };
}

function validateStaffingRules(
  rules: { weekday: number; required_count: number }[]
): string | null {
  for (const r of rules) {
    if (r.weekday < 0 || r.weekday > 7) {
      return "Ungültiger Wochentag";
    }
    if (r.required_count < 0 || r.required_count > 99) {
      return "Anzahl muss zwischen 0 und 99 liegen";
    }
  }
  return null;
}

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

export async function saveShiftTypeStaffing(input: {
  locationId: string;
  locationAreaId: string;
  shiftTypeId: string;
  rules: { weekday: number; required_count: number }[];
}): Promise<LocationStaffingActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    const validationError = validateStaffingRules(input.rules);
    if (validationError) return { ok: false, error: validationError };

    await areaCheck.db.saveLocationAreaStaffingForShiftType(
      input.locationAreaId,
      input.locationId,
      input.shiftTypeId,
      input.rules
    );

    revalidatePath("/dashboard");
    const staffing = await areaCheck.db.listLocationAreaStaffingForArea(
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

export async function deleteShiftTypeStaffing(input: {
  locationId: string;
  locationAreaId: string;
  shiftTypeId: string;
}): Promise<LocationStaffingActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    await areaCheck.db.removeLocationAreaStaffingForShiftType(
      input.locationAreaId,
      input.locationId,
      input.shiftTypeId
    );

    revalidatePath("/dashboard");
    const staffing = await areaCheck.db.listLocationAreaStaffingForArea(
      input.locationAreaId,
      input.locationId
    );
    return { ok: true, staffing };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Löschen fehlgeschlagen",
    };
  }
}
