"use server";

import { revalidatePath } from "next/cache";
import type { AreaQualificationTemplateEntry, Qualification } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type AreaQualificationTemplateActionResult =
  | { ok: true; templates?: AreaQualificationTemplateEntry[] }
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

export async function fetchOrganizationQualificationsForAreaTemplates(): Promise<
  | { ok: true; qualifications: Qualification[] }
  | { ok: false; error: string }
> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const qualifications = await db.listQualifications(organizationId);
    return { ok: true, qualifications };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function fetchAreaQualificationTemplates(
  locationId: string,
  locationAreaId: string
): Promise<AreaQualificationTemplateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      locationId,
      locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    const templates =
      await areaCheck.db.listAreaQualificationTemplatesForArea(
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

export async function assignAreaQualificationTemplate(input: {
  locationId: string;
  locationAreaId: string;
  qualificationId: string;
}): Promise<AreaQualificationTemplateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    await areaCheck.db.assignAreaQualificationTemplate(
      organizationId,
      input.locationAreaId,
      input.locationId,
      input.qualificationId
    );

    revalidatePath("/planer");
    const templates =
      await areaCheck.db.listAreaQualificationTemplatesForArea(
        input.locationAreaId,
        input.locationId
      );
    return { ok: true, templates };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Zuweisen fehlgeschlagen",
    };
  }
}

export async function removeAreaQualificationTemplate(input: {
  locationId: string;
  locationAreaId: string;
  templateId: string;
}): Promise<AreaQualificationTemplateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    await areaCheck.db.removeAreaQualificationTemplate(
      input.locationAreaId,
      input.locationId,
      input.templateId
    );

    revalidatePath("/planer");
    const templates =
      await areaCheck.db.listAreaQualificationTemplatesForArea(
        input.locationAreaId,
        input.locationId
      );
    return { ok: true, templates };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Entfernen fehlgeschlagen",
    };
  }
}

export async function reorderAreaQualificationTemplates(input: {
  locationId: string;
  locationAreaId: string;
  orderedIds: string[];
}): Promise<AreaQualificationTemplateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const areaCheck = await assertLocationArea(
      organizationId,
      input.locationId,
      input.locationAreaId
    );
    if (!areaCheck.ok) return areaCheck;

    await areaCheck.db.reorderAreaQualificationTemplates(
      input.locationAreaId,
      input.locationId,
      input.orderedIds
    );

    const templates =
      await areaCheck.db.listAreaQualificationTemplatesForArea(
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
