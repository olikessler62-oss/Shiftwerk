"use server";

import { revalidatePath } from "next/cache";
import {
  isCompensationSurchargeTrigger,
  isCompensationSurchargeUnit,
  parseSurchargeAmount,
  validateCompensationSurchargeTypeUniqueness,
} from "@schichtwerk/database";
import type { CompensationSurchargeType } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type CompensationSurchargeTypeActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function fetchCompensationSurchargeTypes(): Promise<
  | { ok: true; types: CompensationSurchargeType[] }
  | { ok: false; error: string }
> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const types = await db.listCompensationSurchargeTypes(organizationId);
    return { ok: true, types };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function createCompensationSurchargeType(input: {
  name: string;
  trigger: string;
  amount: string;
  unit: string;
}): Promise<CompensationSurchargeTypeActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    if (!isCompensationSurchargeTrigger(input.trigger)) {
      return { ok: false, error: "Ungültige Bedingung." };
    }
    if (!isCompensationSurchargeUnit(input.unit)) {
      return { ok: false, error: "Ungültige Berechnungsart." };
    }

    const parsedAmount = parseSurchargeAmount(input.amount, input.unit);
    if (!parsedAmount.ok) return parsedAmount;

    const existing = await db.listCompensationSurchargeTypes(organizationId);
    const unique = validateCompensationSurchargeTypeUniqueness(existing, {
      name: input.name,
    });
    if (!unique.ok) return unique;

    const sortOrder =
      await db.getNextCompensationSurchargeTypeSortOrder(organizationId);
    const created = await db.insertCompensationSurchargeType({
      organization_id: organizationId,
      name: input.name.trim(),
      trigger: input.trigger,
      amount: parsedAmount.amount,
      unit: input.unit,
      sort_order: sortOrder,
    });

    revalidatePath("/planer");
    return { ok: true, id: created.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function updateCompensationSurchargeType(input: {
  id: string;
  name: string;
  trigger: string;
  amount: string;
  unit: string;
}): Promise<CompensationSurchargeTypeActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    if (!isCompensationSurchargeTrigger(input.trigger)) {
      return { ok: false, error: "Ungültige Bedingung." };
    }
    if (!isCompensationSurchargeUnit(input.unit)) {
      return { ok: false, error: "Ungültige Berechnungsart." };
    }

    const parsedAmount = parseSurchargeAmount(input.amount, input.unit);
    if (!parsedAmount.ok) return parsedAmount;

    const existing = await db.listCompensationSurchargeTypes(organizationId);
    const unique = validateCompensationSurchargeTypeUniqueness(existing, {
      name: input.name,
      excludeId: input.id,
    });
    if (!unique.ok) return unique;

    await db.updateCompensationSurchargeType(input.id, organizationId, {
      name: input.name.trim(),
      trigger: input.trigger,
      amount: parsedAmount.amount,
      unit: input.unit,
    });

    revalidatePath("/planer");
    return { ok: true, id: input.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function reorderCompensationSurchargeTypes(
  orderedIds: string[]
): Promise<CompensationSurchargeTypeActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.reorderCompensationSurchargeTypes(organizationId, orderedIds);
    revalidatePath("/planer");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Reihenfolge konnte nicht gespeichert werden",
    };
  }
}

export async function deleteCompensationSurchargeType(
  id: string
): Promise<CompensationSurchargeTypeActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.archiveCompensationSurchargeType(id, organizationId);
    revalidatePath("/planer");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Archivieren fehlgeschlagen",
    };
  }
}
