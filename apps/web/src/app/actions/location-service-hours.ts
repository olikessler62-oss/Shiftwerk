"use server";

import { revalidatePath } from "next/cache";
import { validateServiceHoursInput } from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import type { LocationAreaServiceHour } from "@schichtwerk/types";

export type ServiceHoursActionResult =
  | { ok: true; hours?: LocationAreaServiceHour[] }
  | { ok: false; error: string };

export type ServiceHourSourceArea = {
  id: string;
  name: string;
  hours: LocationAreaServiceHour[];
};

export type ServiceHourSourcesActionResult =
  | { ok: true; sources: ServiceHourSourceArea[] }
  | { ok: false; error: string };

export async function fetchLocationAreaServiceHours(
  locationId: string,
  locationAreaId: string
): Promise<ServiceHoursActionResult> {
  try {
    await requireManager();
    const db = await getDatabase();
    const hours = await db.listLocationAreaServiceHoursForArea(
      locationAreaId,
      locationId
    );
    return { ok: true, hours };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function fetchLocationServiceHourSources(
  locationId: string,
  excludeAreaId: string
): Promise<ServiceHourSourcesActionResult> {
  try {
    await requireManager();
    const db = await getDatabase();
    const [areas, allHours] = await Promise.all([
      db.listLocationAreas(locationId),
      db.listLocationAreaServiceHours(locationId),
    ]);

    const hoursByArea = new Map<string, LocationAreaServiceHour[]>();
    for (const hour of allHours) {
      const list = hoursByArea.get(hour.location_area_id) ?? [];
      list.push(hour);
      hoursByArea.set(hour.location_area_id, list);
    }

    const sources = areas
      .filter(
        (area) => area.id !== excludeAreaId && (hoursByArea.get(area.id)?.length ?? 0) > 0
      )
      .map((area) => ({
        id: area.id,
        name: area.name,
        hours: hoursByArea.get(area.id) ?? [],
      }))
      .sort((a, b) => {
        const areaA = areas.find((area) => area.id === a.id);
        const areaB = areas.find((area) => area.id === b.id);
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

export async function saveLocationAreaServiceHours(input: {
  locationId: string;
  locationAreaId: string;
  rows: { weekday: number; start_time: string; end_time: string }[];
}): Promise<ServiceHoursActionResult> {
  try {
    await requireManager();
    const db = await getDatabase();

    const validated = validateServiceHoursInput(input.rows);
    if (!validated.ok) return validated;

    await db.replaceLocationAreaServiceHours(
      input.locationAreaId,
      input.locationId,
      validated.data
    );

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}
