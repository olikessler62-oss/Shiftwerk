"use server";

import { revalidatePath } from "next/cache";
import {
  validateServiceHourStaffingRulesInput,
  validateServiceHoursInput,
} from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import type {
  LocationAreaServiceHour,
  LocationAreaStaffing,
  Qualification,
} from "@schichtwerk/types";

export type LocationStaffingActionResult =
  | {
      ok: true;
      serviceHourId?: string;
      serviceHours?: LocationAreaServiceHour[];
      qualifications?: Qualification[];
      staffing?: LocationAreaStaffing[];
    }
  | { ok: false; error: string };

async function assertServiceHour(
  organizationId: string,
  locationId: string,
  serviceHourId: string
) {
  const db = await getDatabase();
  const locations = await db.listLocations(organizationId);
  if (!locations.some((location) => location.id === locationId)) {
    return { ok: false as const, error: "Standort nicht gefunden" };
  }
  const hours = await db.listLocationAreaServiceHours(locationId);
  const hour = hours.find((entry) => entry.id === serviceHourId);
  if (!hour) {
    return { ok: false as const, error: "Servicezeit nicht gefunden" };
  }
  return { ok: true as const, db, hour };
}

function serviceHourHasStaffing(
  staffing: LocationAreaStaffing[],
  serviceHourId: string
): boolean {
  return staffing.some(
    (rule) => rule.service_hour_id === serviceHourId && rule.required_count > 0
  );
}

export async function fetchLocationStaffingEditor(
  locationId: string,
  locationAreaId: string | null
): Promise<LocationStaffingActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const locations = await db.listLocations(organizationId);
    if (!locations.some((location) => location.id === locationId)) {
      return { ok: false, error: "Standort nicht gefunden" };
    }

    const [serviceHours, qualifications, staffing] = await Promise.all([
      locationAreaId
        ? db.listLocationAreaServiceHoursForArea(locationAreaId, locationId)
        : Promise.resolve([]),
      db.listQualifications(organizationId),
      locationAreaId
        ? db.listLocationAreaStaffingForArea(locationAreaId, locationId)
        : Promise.resolve([]),
    ]);

    return { ok: true, serviceHours, qualifications, staffing };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function saveServiceHourStaffing(input: {
  locationId: string;
  locationAreaId: string;
  window: { weekday: number; start_time: string; end_time: string };
  previousServiceHourId?: string;
  rules: {
    qualification_id: string;
    required_count: number;
  }[];
}): Promise<LocationStaffingActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const locations = await db.listLocations(organizationId);
    if (!locations.some((location) => location.id === input.locationId)) {
      return { ok: false, error: "Standort nicht gefunden" };
    }

    const windowCheck = validateServiceHoursInput([input.window]);
    if (!windowCheck.ok) return windowCheck;

    const qualifications = await db.listQualifications(organizationId);
    const qualIds = new Set(qualifications.map((qualification) => qualification.id));
    const validated = validateServiceHourStaffingRulesInput(input.rules, qualIds);
    if (!validated.ok) return validated;

    const existingStaffing = await db.listLocationAreaStaffingForArea(
      input.locationAreaId,
      input.locationId
    );

    const hour = await db.ensureLocationAreaServiceHour(
      input.locationAreaId,
      input.locationId,
      windowCheck.data[0]!,
      input.previousServiceHourId
        ? { excludeServiceHourId: input.previousServiceHourId }
        : undefined
    );

    if (
      serviceHourHasStaffing(existingStaffing, hour.id) &&
      input.previousServiceHourId !== hour.id
    ) {
      return {
        ok: false,
        error: "Für dieses Zeitfenster ist bereits Personalbedarf hinterlegt.",
      };
    }

    await db.saveLocationAreaStaffingForServiceHour(
      hour.id,
      input.locationId,
      validated.data
    );

    if (
      input.previousServiceHourId &&
      input.previousServiceHourId !== hour.id
    ) {
      await db.removeLocationAreaStaffingForServiceHour(
        input.previousServiceHourId,
        input.locationId
      );
    }

    const [staffing, serviceHours] = await Promise.all([
      db.listLocationAreaStaffingForArea(input.locationAreaId, input.locationId),
      db.listLocationAreaServiceHoursForArea(
        input.locationAreaId,
        input.locationId
      ),
    ]);
    try {
      revalidatePath("/dashboard");
    } catch {
      /* Cache-Revalidierung darf Speichern nicht fehlschlagen lassen */
    }
    return { ok: true, serviceHourId: hour.id, staffing, serviceHours };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function deleteServiceHourStaffing(input: {
  locationId: string;
  serviceHourId: string;
}): Promise<LocationStaffingActionResult> {
  try {
    const { organizationId } = await requireManager();
    const hourCheck = await assertServiceHour(
      organizationId,
      input.locationId,
      input.serviceHourId
    );
    if (!hourCheck.ok) return hourCheck;

    await hourCheck.db.removeLocationAreaStaffingForServiceHour(
      input.serviceHourId,
      input.locationId
    );

    revalidatePath("/dashboard");
    const staffing = await hourCheck.db.listLocationAreaStaffingForArea(
      hourCheck.hour.location_area_id,
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
