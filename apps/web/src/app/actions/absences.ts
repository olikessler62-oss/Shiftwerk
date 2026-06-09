"use server";

import { revalidatePath } from "next/cache";
import {
  findOverlappingAbsence,
  validateAbsenceDateOrder,
  type AbsenceRange,
} from "@schichtwerk/database";
import type { AbsenceType } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type AbsenceDraft = {
  employee_id: string;
  type: AbsenceType;
  start_date: string;
  end_date: string;
  notes: string | null;
};

export type AbsenceBatchCreate = {
  tempId: string;
  draft: AbsenceDraft;
};

export type AbsenceBatchUpdate = {
  id: string;
  draft: AbsenceDraft;
};

export type AbsenceBatchInput = {
  creates: AbsenceBatchCreate[];
  updates: AbsenceBatchUpdate[];
  deletes: string[];
};

export type AbsenceActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export type FetchOrganizationAbsencesResult =
  | { ok: true; absences: import("@schichtwerk/types").AbsenceRequest[] }
  | { ok: false; error: string };

export type CheckAbsenceShiftConflictsResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

function normalizeNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : null;
}

function validateDraft(
  draft: AbsenceDraft,
  existing: AbsenceRange[],
  excludeId?: string
): string | null {
  if (!draft.employee_id) return "MISSING_EMPLOYEE";
  if (!draft.type) return "MISSING_TYPE";
  if (!draft.start_date || !draft.end_date) return "MISSING_DATES";

  const dateOrder = validateAbsenceDateOrder(draft.start_date, draft.end_date);
  if (!dateOrder.ok) return "END_BEFORE_START";

  const overlap = findOverlappingAbsence(
    existing,
    {
      id: excludeId,
      employee_id: draft.employee_id,
      start_date: draft.start_date,
      end_date: draft.end_date,
    },
    excludeId
  );
  if (overlap) return "OVERLAP";

  return null;
}

function buildEffectiveRanges(
  baseline: AbsenceRange[],
  batch: AbsenceBatchInput
): AbsenceRange[] {
  const deleted = new Set(batch.deletes);
  const updatedById = new Map(batch.updates.map((entry) => [entry.id, entry.draft]));

  const effective: AbsenceRange[] = [];

  for (const entry of baseline) {
    if (deleted.has(entry.id!)) continue;
    const update = updatedById.get(entry.id!);
    if (update) {
      effective.push({
        id: entry.id,
        employee_id: update.employee_id,
        start_date: update.start_date,
        end_date: update.end_date,
      });
      continue;
    }
    effective.push(entry);
  }

  for (const create of batch.creates) {
    effective.push({
      id: create.tempId,
      employee_id: create.draft.employee_id,
      start_date: create.draft.start_date,
      end_date: create.draft.end_date,
    });
  }

  return effective;
}

export async function fetchOrganizationAbsences(): Promise<FetchOrganizationAbsencesResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const absences = await db.listOrganizationAbsences(organizationId, "approved");
    return { ok: true, absences };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function checkAbsenceShiftConflicts(
  batch: AbsenceBatchInput
): Promise<CheckAbsenceShiftConflictsResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const baseline = await db.listOrganizationAbsences(organizationId, "approved");
    const baselineRanges: AbsenceRange[] = baseline.map((entry) => ({
      id: entry.id,
      employee_id: entry.employee_id,
      start_date: entry.start_date,
      end_date: entry.end_date,
    }));
    const effective = buildEffectiveRanges(baselineRanges, batch);
    const count = await db.countShiftsConflictingWithAbsenceRanges(
      organizationId,
      effective
    );
    return { ok: true, count };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Prüfung fehlgeschlagen",
    };
  }
}

export async function saveAbsenceBatch(
  batch: AbsenceBatchInput
): Promise<AbsenceActionResult> {
  try {
    const { userId, organizationId } = await requireManager();
    const db = await getDatabase();

    const baseline = await db.listOrganizationAbsences(organizationId, "approved");
    const baselineRanges: AbsenceRange[] = baseline.map((entry) => ({
      id: entry.id,
      employee_id: entry.employee_id,
      start_date: entry.start_date,
      end_date: entry.end_date,
    }));

    const effective = buildEffectiveRanges(baselineRanges, batch);

    for (const create of batch.creates) {
      const draft = {
        ...create.draft,
        notes: normalizeNotes(create.draft.notes),
      };
      const errorCode = validateDraft(draft, effective, create.tempId);
      if (errorCode) return { ok: false, error: errorCode };
    }

    for (const update of batch.updates) {
      const draft = {
        ...update.draft,
        notes: normalizeNotes(update.draft.notes),
      };
      const errorCode = validateDraft(draft, effective, update.id);
      if (errorCode) return { ok: false, error: errorCode };
    }

    for (const id of batch.deletes) {
      if (!baseline.some((entry) => entry.id === id)) {
        return { ok: false, error: "NOT_FOUND" };
      }
    }

    for (const id of batch.deletes) {
      await db.deleteAbsenceRequest(id, organizationId);
    }

    let lastCreatedId: string | undefined;

    for (const update of batch.updates) {
      const draft = {
        ...update.draft,
        notes: normalizeNotes(update.draft.notes),
      };
      await db.updateAbsenceRequest(update.id, organizationId, {
        employee_id: draft.employee_id,
        type: draft.type,
        start_date: draft.start_date,
        end_date: draft.end_date,
        status: "approved",
        notes: draft.notes,
        reviewed_by: userId,
      });
    }

    for (const create of batch.creates) {
      const draft = {
        ...create.draft,
        notes: normalizeNotes(create.draft.notes),
      };
      const createdId = await db.insertAbsenceRequest({
        organization_id: organizationId,
        employee_id: draft.employee_id,
        type: draft.type,
        start_date: draft.start_date,
        end_date: draft.end_date,
        status: "approved",
        notes: draft.notes,
        reviewed_by: userId,
      });
      lastCreatedId = createdId;
    }

    revalidatePath("/dashboard");
    return { ok: true, id: lastCreatedId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function createAbsence(
  draft: AbsenceDraft
): Promise<AbsenceActionResult> {
  return saveAbsenceBatch({
    creates: [{ tempId: "new", draft }],
    updates: [],
    deletes: [],
  });
}

export async function updateAbsence(
  id: string,
  draft: AbsenceDraft
): Promise<AbsenceActionResult> {
  return saveAbsenceBatch({
    creates: [],
    updates: [{ id, draft }],
    deletes: [],
  });
}

export async function deleteAbsence(id: string): Promise<AbsenceActionResult> {
  return saveAbsenceBatch({
    creates: [],
    updates: [],
    deletes: [id],
  });
}

export async function checkAbsenceShiftConflictForDraft(
  draft: AbsenceDraft,
  excludeAbsenceId?: string
): Promise<CheckAbsenceShiftConflictsResult> {
  const batch: AbsenceBatchInput = excludeAbsenceId
    ? { creates: [], updates: [{ id: excludeAbsenceId, draft }], deletes: [] }
    : { creates: [{ tempId: "new", draft }], updates: [], deletes: [] };
  return checkAbsenceShiftConflicts(batch);
}
