"use server";

import { revalidatePath } from "next/cache";
import { validateServiceHoursInput } from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type ServiceHoursActionResult =
  | { ok: true; hours?: import("@schichtwerk/types").LocationAreaServiceHour[] }
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
