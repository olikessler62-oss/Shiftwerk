"use server";

import { revalidatePath } from "next/cache";
import { validateStaffingRulesInput } from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import type {
  LocationAreaStaffing,
  Qualification,
  ShiftType,
} from "@schichtwerk/types";

export type LocationStaffingActionResult =
  | {
      ok: true;
      shiftTypes?: ShiftType[];
      qualifications?: Qualification[];
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

    const [shiftTypes, qualifications, staffing] = await Promise.all([
      db.listShiftTypes(organizationId),
      db.listQualifications(organizationId),
      locationAreaId
        ? db.listLocationAreaStaffingForArea(locationAreaId, locationId)
        : Promise.resolve([]),
    ]);

    return { ok: true, shiftTypes, qualifications, staffing };
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
  rules: {
    weekday: number;
    qualification_id: string;
    required_count: number;
  }[];
}): Promise<LocationStaffingActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    const qualifications = await areaCheck.db.listQualifications(organizationId);
    const qualIds = new Set(qualifications.map((q) => q.id));
    const validated = validateStaffingRulesInput(input.rules, qualIds);
    if (!validated.ok) return validated;

    await areaCheck.db.saveLocationAreaStaffingForShiftType(
      input.locationAreaId,
      input.locationId,
      input.shiftTypeId,
      validated.data
    );

    const staffing = await areaCheck.db.listLocationAreaStaffingForArea(
      input.locationAreaId,
      input.locationId
    );
    try {
      revalidatePath("/dashboard");
    } catch {
      /* Cache-Revalidierung darf Speichern nicht fehlschlagen lassen */
    }
    return { ok: true, staffing };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Speichern fehlgeschlagen";
    if (
      message.includes(
        "location_area_staffing_location_area_id_shift_type_id_weekd"
      )
    ) {
      return {
        ok: false,
        error:
          "Der alte Datenbank-Constraint blockiert mehrere Positionen pro Tag. Bitte die Migration 20250624_drop_old_staffing_unique_truncated.sql in Supabase ausführen (behebt gekürzte Constraint-Namen).",
      };
    }
    return { ok: false, error: message };
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
