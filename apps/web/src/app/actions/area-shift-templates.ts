"use server";

import { revalidatePath } from "next/cache";
import {
  validateAreaShiftTemplateCount,
  validateShiftTypeBreaks,
  validateShiftTypeUniqueness,
  resolveShiftTemplateSaveColor,
} from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import type { ShiftTypeBreakInput } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import type { AreaShiftTemplateWithBreaks } from "@schichtwerk/types";

export type AreaShiftTemplateActionResult =
  | { ok: true; id?: string; templates?: AreaShiftTemplateWithBreaks[] }
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

export async function fetchAreaShiftTemplates(
  locationId: string,
  locationAreaId: string
): Promise<AreaShiftTemplateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      locationId,
      locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    const templates = await areaCheck.db.listAreaShiftTemplatesWithBreaksForArea(
      locationAreaId,
      locationId
    );
    return { ok: true, templates };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function createAreaShiftTemplate(input: {
  locationId: string;
  locationAreaId: string;
  name: string;
  start_time: string;
  end_time: string;
  color?: string;
  breaks: ShiftTypeBreakInput[];
}): Promise<AreaShiftTemplateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    const existing = await areaCheck.db.listAreaShiftTemplatesWithBreaksForArea(
      input.locationAreaId,
      input.locationId
    );
    const countCheck = validateAreaShiftTemplateCount(existing.length, true);
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

    const sortOrder = await areaCheck.db.getNextAreaShiftTemplateSortOrder(
      input.locationAreaId,
      input.locationId
    );

    const color = resolveShiftTemplateSaveColor(input.name.trim(), input.color);

    const created = await areaCheck.db.insertAreaShiftTemplate({
      location_area_id: input.locationAreaId,
      name: input.name.trim(),
      start_time: input.start_time,
      end_time: input.end_time,
      color,
      sort_order: sortOrder,
    });

    await areaCheck.db.replaceAreaShiftTemplateBreaks(created.id, input.breaks);

    revalidatePath("/dashboard");
    const templates = await areaCheck.db.listAreaShiftTemplatesWithBreaksForArea(
      input.locationAreaId,
      input.locationId
    );
    return { ok: true, id: created.id, templates };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function updateAreaShiftTemplate(input: {
  id: string;
  locationId: string;
  locationAreaId: string;
  name: string;
  start_time: string;
  end_time: string;
  color?: string;
  breaks: ShiftTypeBreakInput[];
}): Promise<AreaShiftTemplateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    const existing = await areaCheck.db.listAreaShiftTemplatesWithBreaksForArea(
      input.locationAreaId,
      input.locationId
    );

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

    await areaCheck.db.updateAreaShiftTemplate(
      input.id,
      input.locationAreaId,
      input.locationId,
      {
        name: input.name.trim(),
        start_time: input.start_time,
        end_time: input.end_time,
        color: resolveShiftTemplateSaveColor(input.name.trim(), input.color),
      }
    );
    await areaCheck.db.replaceAreaShiftTemplateBreaks(input.id, input.breaks);

    revalidatePath("/dashboard");
    const templates = await areaCheck.db.listAreaShiftTemplatesWithBreaksForArea(
      input.locationAreaId,
      input.locationId
    );
    return { ok: true, templates };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function deleteAreaShiftTemplate(input: {
  id: string;
  locationId: string;
  locationAreaId: string;
}): Promise<AreaShiftTemplateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    await areaCheck.db.archiveAreaShiftTemplate(
      input.id,
      input.locationAreaId,
      input.locationId
    );

    revalidatePath("/dashboard");
    const templates = await areaCheck.db.listAreaShiftTemplatesWithBreaksForArea(
      input.locationAreaId,
      input.locationId
    );
    return { ok: true, templates };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Löschen fehlgeschlagen",
    };
  }
}

export async function reorderAreaShiftTemplates(input: {
  locationId: string;
  locationAreaId: string;
  orderedIds: string[];
}): Promise<AreaShiftTemplateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    await areaCheck.db.reorderAreaShiftTemplates(
      input.locationAreaId,
      input.locationId,
      input.orderedIds
    );

    const templates = await areaCheck.db.listAreaShiftTemplatesWithBreaksForArea(
      input.locationAreaId,
      input.locationId
    );
    return { ok: true, templates };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Sortieren fehlgeschlagen",
    };
  }
}
