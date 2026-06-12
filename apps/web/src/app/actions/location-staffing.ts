"use server";

import { revalidatePath } from "next/cache";
import {
  validateServiceHourStaffingRulesInput,
  validateServiceHoursInput,
  qualificationsForArea,
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

export type StaffingSourceArea = {
  id: string;
  name: string;
  serviceHours: LocationAreaServiceHour[];
  staffing: LocationAreaStaffing[];
};

export type StaffingSourcesActionResult =
  | { ok: true; sources: StaffingSourceArea[] }
  | { ok: false; error: string };

async function assertLocationArea(
  organizationId: string,
  locationId: string,
  locationAreaId: string
) {
  const db = await getDatabase();
  const locations = await db.listLocations(organizationId);
  if (!locations.some((location) => location.id === locationId)) {
    return { ok: false as const, error: "Standort nicht gefunden" };
  }
  const areas = await db.listLocationAreas(locationId);
  if (!areas.some((area) => area.id === locationAreaId)) {
    return { ok: false as const, error: "Bereich nicht gefunden" };
  }
  return { ok: true as const, db };
}

function areaHasStaffing(staffing: readonly LocationAreaStaffing[]): boolean {
  return staffing.some((rule) => rule.required_count > 0);
}

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

    const [serviceHours, organizationQualifications, areaTemplateEntries, staffing] =
      await Promise.all([
      locationAreaId
        ? db.listLocationAreaServiceHoursForArea(locationAreaId, locationId)
        : Promise.resolve([]),
      db.listQualifications(organizationId),
      locationAreaId
        ? db.listAreaQualificationTemplatesForArea(locationAreaId, locationId)
        : Promise.resolve([]),
      locationAreaId
        ? db.listLocationAreaStaffingForArea(locationAreaId, locationId)
        : Promise.resolve([]),
    ]);

    const areaQualifications = areaTemplateEntries.map(
      (entry) => entry.qualification
    );
    const qualifications = qualificationsForArea(
      areaQualifications,
      organizationQualifications
    );

    return { ok: true, serviceHours, qualifications, staffing };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function fetchLocationStaffingSources(
  locationId: string,
  excludeAreaId: string
): Promise<StaffingSourcesActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      locationId,
      excludeAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    const [areas, allHours, allStaffing] = await Promise.all([
      areaCheck.db.listLocationAreas(locationId),
      areaCheck.db.listLocationAreaServiceHours(locationId),
      areaCheck.db.listLocationAreaStaffing(locationId),
    ]);

    const hoursByArea = new Map<string, LocationAreaServiceHour[]>();
    for (const hour of allHours) {
      const list = hoursByArea.get(hour.location_area_id) ?? [];
      list.push(hour);
      hoursByArea.set(hour.location_area_id, list);
    }

    const staffingByArea = new Map<string, LocationAreaStaffing[]>();
    for (const rule of allStaffing) {
      const list = staffingByArea.get(rule.location_area_id) ?? [];
      list.push(rule);
      staffingByArea.set(rule.location_area_id, list);
    }

    const sources = areas
      .filter(
        (entry) =>
          entry.id !== excludeAreaId &&
          areaHasStaffing(staffingByArea.get(entry.id) ?? [])
      )
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        serviceHours: hoursByArea.get(entry.id) ?? [],
        staffing: staffingByArea.get(entry.id) ?? [],
      }))
      .sort((a, b) => {
        const areaA = areas.find((entry) => entry.id === a.id);
        const areaB = areas.find((entry) => entry.id === b.id);
        return (areaA?.sort_order ?? 0) - (areaB?.sort_order ?? 0);
      });

    return { ok: true, sources };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function copyLocationStaffingFromArea(input: {
  locationId: string;
  targetAreaId: string;
  sourceAreaId: string;
}): Promise<LocationStaffingActionResult> {
  try {
    const { organizationId } = await requireManager();
    const targetCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.targetAreaId
    );
    if (!targetCheck.ok) return targetCheck;

    const sourceCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.sourceAreaId
    );
    if (!sourceCheck.ok) return sourceCheck;

    const db = targetCheck.db;
    const [
      sourceHours,
      sourceStaffing,
      organizationQualifications,
      targetTemplateEntries,
    ] = await Promise.all([
      db.listLocationAreaServiceHoursForArea(
        input.sourceAreaId,
        input.locationId
      ),
      db.listLocationAreaStaffingForArea(input.sourceAreaId, input.locationId),
      db.listQualifications(organizationId),
      db.listAreaQualificationTemplatesForArea(input.targetAreaId, input.locationId),
    ]);

    if (!areaHasStaffing(sourceStaffing)) {
      return { ok: false, error: "Kein Personalbedarf zum Übernehmen vorhanden" };
    }

    const targetQualifications = qualificationsForArea(
      targetTemplateEntries.map((entry) => entry.qualification),
      organizationQualifications
    );
    const targetQualIds = new Set(targetQualifications.map((qual) => qual.id));
    const orgQualNameById = new Map(
      organizationQualifications.map((qual) => [qual.id, qual.name.trim()])
    );
    const targetQualIdByName = new Map(
      targetQualifications.map((qual) => [qual.name.trim(), qual.id])
    );

    const staffedHourIds = new Set<string>();
    for (const rule of sourceStaffing) {
      if (rule.required_count > 0) staffedHourIds.add(rule.service_hour_id);
    }

    const nextRules: {
      service_hour_id: string;
      qualification_id: string;
      required_count: number;
    }[] = [];

    for (const sourceHour of sourceHours) {
      if (!staffedHourIds.has(sourceHour.id)) continue;

      const mappedRules: {
        qualification_id: string;
        required_count: number;
      }[] = [];
      for (const rule of sourceStaffing) {
        if (rule.service_hour_id !== sourceHour.id || rule.required_count <= 0) {
          continue;
        }
        if (!targetQualIds.has(rule.qualification_id)) {
          const qualName = orgQualNameById.get(rule.qualification_id);
          const mappedId = qualName ? targetQualIdByName.get(qualName) : undefined;
          if (!mappedId) continue;
          mappedRules.push({
            qualification_id: mappedId,
            required_count: rule.required_count,
          });
          continue;
        }
        mappedRules.push({
          qualification_id: rule.qualification_id,
          required_count: rule.required_count,
        });
      }

      if (mappedRules.length === 0) continue;

      const validated = validateServiceHourStaffingRulesInput(
        mappedRules,
        targetQualIds
      );
      if (!validated.ok) return validated;

      const targetHour = await db.ensureLocationAreaServiceHour(
        input.targetAreaId,
        input.locationId,
        {
          weekday: sourceHour.weekday,
          start_time: sourceHour.start_time,
          end_time: sourceHour.end_time,
        }
      );

      for (const rule of validated.data) {
        nextRules.push({
          service_hour_id: targetHour.id,
          qualification_id: rule.qualification_id,
          required_count: rule.required_count,
        });
      }
    }

    if (nextRules.length === 0) {
      return {
        ok: false,
        error:
          "Personalbedarf konnte nicht übernommen werden (keine passenden Jobs im Zielbereich).",
      };
    }

    await db.replaceLocationAreaStaffing(
      input.targetAreaId,
      input.locationId,
      nextRules
    );

    const [staffing, serviceHours, qualifications] = await Promise.all([
      db.listLocationAreaStaffingForArea(input.targetAreaId, input.locationId),
      db.listLocationAreaServiceHoursForArea(input.targetAreaId, input.locationId),
      Promise.resolve(
        qualificationsForArea(
          targetTemplateEntries.map((entry) => entry.qualification),
          organizationQualifications
        )
      ),
    ]);

    revalidatePath("/dashboard");
    return { ok: true, staffing, serviceHours, qualifications };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Übernehmen fehlgeschlagen",
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

    const organizationQualifications = await db.listQualifications(organizationId);
    const areaTemplateEntries = await db.listAreaQualificationTemplatesForArea(
      input.locationAreaId,
      input.locationId
    );
    const selectableQualifications = qualificationsForArea(
      areaTemplateEntries.map((entry) => entry.qualification),
      organizationQualifications
    );
    const qualIds = new Set(
      selectableQualifications.map((qualification) => qualification.id)
    );
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
