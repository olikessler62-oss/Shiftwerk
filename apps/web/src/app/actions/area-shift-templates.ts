"use server";

import { revalidatePath } from "next/cache";
import {
  validateAreaShiftTemplateCount,
  validateShiftTypeBreaks,
  validateShiftTypeUniqueness,
  validateShiftDurationForCountry,
  DEFAULT_COUNTRY_CODE,
  resolveShiftTemplateSaveColor,
} from "@schichtwerk/database";
import { getDatabase } from "@/lib/db";
import type { ShiftTypeBreakInput, SchichtwerkDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import type { AreaShiftTemplateWithBreaks } from "@schichtwerk/types";

export type AreaShiftTemplateActionResult =
  | { ok: true; id?: string; templates?: AreaShiftTemplateWithBreaks[] }
  | { ok: false; error: string };

export type AreaShiftTemplateSourceArea = {
  id: string;
  name: string;
  templates: AreaShiftTemplateWithBreaks[];
};

export type AreaShiftTemplateSourcesActionResult =
  | { ok: true; sources: AreaShiftTemplateSourceArea[] }
  | { ok: false; error: string };

function formatAreaShiftTemplateActionError(
  error: unknown,
  fallback: string
): string {
  if (!(error instanceof Error)) return fallback;
  if (
    error.message.includes("area_shift_templates_location_area_id_name") ||
    error.message.includes("duplicate key value")
  ) {
    return "Schichtvorlagen-Bezeichnungen dürfen nicht doppelt vorkommen.";
  }
  return error.message;
}

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

async function validateTemplateLaborCompliance(
  db: SchichtwerkDatabase,
  organizationId: string,
  start_time: string,
  end_time: string,
  breaks: ShiftTypeBreakInput[]
): Promise<AreaShiftTemplateActionResult | { ok: true }> {
  const countryCode =
    (await db.getOrganizationCountryCode(organizationId)) ?? DEFAULT_COUNTRY_CODE;

  const durationCheck = validateShiftDurationForCountry({
    countryCode,
    start_time,
    end_time,
    weekday: 0,
    point: "shift_template",
  });
  if (!durationCheck.ok) return durationCheck;

  const breaksCheck = validateShiftTypeBreaks(
    start_time,
    end_time,
    breaks,
    countryCode
  );
  if (!breaksCheck.ok) return breaksCheck;

  return { ok: true };
}

export async function fetchOrganizationCountryCode(): Promise<
  { ok: true; countryCode: string } | { ok: false; error: string }
> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const countryCode =
      (await db.getOrganizationCountryCode(organizationId)) ?? DEFAULT_COUNTRY_CODE;
    return { ok: true, countryCode };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function fetchAreaShiftTemplateSources(
  locationId: string,
  excludeAreaId: string
): Promise<AreaShiftTemplateSourcesActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      locationId,
      excludeAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    const [areas, allTemplates] = await Promise.all([
      areaCheck.db.listLocationAreas(locationId),
      areaCheck.db.listAreaShiftTemplatesWithBreaksForLocation(locationId),
    ]);

    const templatesByArea = new Map<string, AreaShiftTemplateWithBreaks[]>();
    for (const template of allTemplates) {
      const list = templatesByArea.get(template.location_area_id) ?? [];
      list.push(template);
      templatesByArea.set(template.location_area_id, list);
    }

    const sources = areas
      .filter(
        (entry) =>
          entry.id !== excludeAreaId &&
          (templatesByArea.get(entry.id)?.length ?? 0) > 0
      )
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        templates: templatesByArea.get(entry.id) ?? [],
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

export async function copyAreaShiftTemplatesFromArea(input: {
  locationId: string;
  targetAreaId: string;
  sourceAreaId: string;
}): Promise<AreaShiftTemplateActionResult> {
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
    const sourceTemplates = await db.listAreaShiftTemplatesWithBreaksForArea(
      input.sourceAreaId,
      input.locationId
    );
    if (sourceTemplates.length === 0) {
      return { ok: false, error: "Keine Schichtvorlagen zum Übernehmen vorhanden" };
    }

    await db.clearAreaShiftTemplatesForArea(input.targetAreaId, input.locationId);

    let sortOrder = 0;
    for (const template of sourceTemplates) {
      const created = await db.insertAreaShiftTemplate({
        location_area_id: input.targetAreaId,
        name: template.name,
        start_time: template.start_time,
        end_time: template.end_time,
        color: template.color,
        sort_order: sortOrder,
      });
      const breaks =
        template.area_shift_template_breaks?.map((entry) => ({
          break_start: entry.break_start,
          break_end: entry.break_end,
        })) ?? [];
      await db.replaceAreaShiftTemplateBreaks(created.id, breaks);
      sortOrder += 1;
    }

    revalidatePath("/dashboard");
    const templates = await db.listAreaShiftTemplatesWithBreaksForArea(
      input.targetAreaId,
      input.locationId
    );
    return { ok: true, templates };
  } catch (e) {
    return {
      ok: false,
      error: formatAreaShiftTemplateActionError(e, "Übernehmen fehlgeschlagen"),
    };
  }
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

    const complianceCheck = await validateTemplateLaborCompliance(
      areaCheck.db,
      organizationId,
      input.start_time,
      input.end_time,
      input.breaks
    );
    if (!complianceCheck.ok) return complianceCheck;

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

    const complianceCheck = await validateTemplateLaborCompliance(
      areaCheck.db,
      organizationId,
      input.start_time,
      input.end_time,
      input.breaks
    );
    if (!complianceCheck.ok) return complianceCheck;

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
