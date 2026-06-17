"use server";

import { revalidatePath } from "next/cache";
import {
  absenceRangeForShiftConflict,
  absenceRequestToRange,
  findOverlappingAbsence,
  validateAbsenceDateOrder,
  validateOpenEndedSickOnly,
  type AbsenceRange,
} from "@schichtwerk/database";
import type { AbsenceRequest, AbsenceType, RequestStatus } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type AbsenceDraft = {
  employee_id: string;
  type: AbsenceType;
  start_date: string;
  end_date: string | null;
  is_open_ended: boolean;
  expected_end_date: string | null;
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
  | { ok: true; absences: AbsenceRequest[] }
  | { ok: false; error: string };

export type FetchProfileAbsencesResult =
  | { ok: true; absences: AbsenceRequest[] }
  | { ok: false; error: string };

export type CheckAbsenceShiftConflictsResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

const OVERLAP_STATUSES: RequestStatus[] = ["approved", "pending"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : null;
}

function normalizeExpectedEnd(
  expectedEnd: string | null | undefined
): string | null {
  const trimmed = expectedEnd?.trim();
  return trimmed ? trimmed : null;
}

function draftToRange(draft: AbsenceDraft, id?: string): AbsenceRange {
  return {
    id,
    employee_id: draft.employee_id,
    start_date: draft.start_date,
    end_date: draft.is_open_ended ? null : draft.end_date,
    is_open_ended: draft.is_open_ended,
  };
}

function validateDraft(
  draft: AbsenceDraft,
  existing: AbsenceRange[],
  excludeId?: string
): string | null {
  if (!draft.employee_id) return "MISSING_EMPLOYEE";
  if (!draft.type) return "MISSING_TYPE";
  if (!draft.start_date) return "MISSING_DATES";

  const openEndedCheck = validateOpenEndedSickOnly(draft.type, draft.is_open_ended);
  if (!openEndedCheck.ok) return "OPEN_ENDED_NOT_SICK";

  const dateOrder = validateAbsenceDateOrder(
    draft.start_date,
    draft.end_date,
    draft.is_open_ended
  );
  if (!dateOrder.ok) {
    return dateOrder.code === "missingEnd" ? "MISSING_DATES" : "END_BEFORE_START";
  }

  const overlap = findOverlappingAbsence(
    existing,
    draftToRange(draft, excludeId),
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
      effective.push(draftToRange(update, entry.id));
      continue;
    }
    effective.push(entry);
  }

  for (const create of batch.creates) {
    effective.push(draftToRange(create.draft, create.tempId));
  }

  return effective;
}

function rangesForConflictCheck(
  ranges: AbsenceRange[],
  referenceDateISO: string
): { employee_id: string; start_date: string; end_date: string }[] {
  return ranges.map((range) => absenceRangeForShiftConflict(range, referenceDateISO));
}

async function listOverlapBaseline(
  organizationId: string,
  employeeId?: string
): Promise<AbsenceRange[]> {
  const db = await getDatabase();
  const absences = await db.listOrganizationAbsences(organizationId, {
    statuses: OVERLAP_STATUSES,
    employeeId,
  });
  return absences.map((entry) => absenceRequestToRange(entry));
}

export async function fetchOrganizationAbsences(): Promise<FetchOrganizationAbsencesResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const absences = await db.listOrganizationAbsences(organizationId);
    return { ok: true, absences };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function fetchProfileAbsences(
  profileId: string
): Promise<FetchProfileAbsencesResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const absences = await db.listOrganizationAbsences(organizationId, {
      employeeId: profileId,
    });
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
    const employeeIds = new Set<string>();
    for (const create of batch.creates) {
      employeeIds.add(create.draft.employee_id);
    }
    for (const update of batch.updates) {
      employeeIds.add(update.draft.employee_id);
    }

    const baseline: AbsenceRange[] = [];
    for (const employeeId of employeeIds) {
      const rows = await listOverlapBaseline(organizationId, employeeId);
      baseline.push(...rows);
    }

    const effective = buildEffectiveRanges(baseline, batch);
    const referenceDate = todayISO();
    const count = await db.countShiftsConflictingWithAbsenceRanges(
      organizationId,
      rangesForConflictCheck(effective, referenceDate)
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

    const employeeIds = new Set<string>();
    for (const create of batch.creates) {
      employeeIds.add(create.draft.employee_id);
    }
    for (const update of batch.updates) {
      employeeIds.add(update.draft.employee_id);
    }

    const baseline: AbsenceRange[] = [];
    for (const employeeId of employeeIds) {
      const rows = await listOverlapBaseline(organizationId, employeeId);
      baseline.push(...rows);
    }

    const effective = buildEffectiveRanges(baseline, batch);

    for (const create of batch.creates) {
      const draft = {
        ...create.draft,
        notes: normalizeNotes(create.draft.notes),
        expected_end_date: normalizeExpectedEnd(create.draft.expected_end_date),
      };
      const errorCode = validateDraft(draft, effective, create.tempId);
      if (errorCode) return { ok: false, error: errorCode };
    }

    for (const update of batch.updates) {
      const draft = {
        ...update.draft,
        notes: normalizeNotes(update.draft.notes),
        expected_end_date: normalizeExpectedEnd(update.draft.expected_end_date),
      };
      const errorCode = validateDraft(draft, effective, update.id);
      if (errorCode) return { ok: false, error: errorCode };
    }

    const allAbsences = await db.listOrganizationAbsences(organizationId);

    for (const id of batch.deletes) {
      if (!allAbsences.some((entry) => entry.id === id)) {
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
        expected_end_date: normalizeExpectedEnd(update.draft.expected_end_date),
      };
      await db.updateAbsenceRequest(update.id, organizationId, {
        employee_id: draft.employee_id,
        type: draft.type,
        start_date: draft.start_date,
        end_date: draft.is_open_ended ? null : draft.end_date,
        is_open_ended: draft.is_open_ended,
        expected_end_date: draft.expected_end_date,
        status: "approved",
        notes: draft.notes,
        reviewed_by: userId,
        reported_by: userId,
      });
    }

    for (const create of batch.creates) {
      const draft = {
        ...create.draft,
        notes: normalizeNotes(create.draft.notes),
        expected_end_date: normalizeExpectedEnd(create.draft.expected_end_date),
      };
      const createdId = await db.insertAbsenceRequest({
        organization_id: organizationId,
        employee_id: draft.employee_id,
        type: draft.type,
        start_date: draft.start_date,
        end_date: draft.is_open_ended ? null : draft.end_date,
        is_open_ended: draft.is_open_ended,
        expected_end_date: draft.expected_end_date,
        status: "approved",
        notes: draft.notes,
        reviewed_by: userId,
        reported_by: userId,
      });
      lastCreatedId = createdId;
    }

    revalidatePath("/dashboard");
    revalidatePath("/planung");
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

export async function reviewAbsenceRequest(
  id: string,
  approve: boolean
): Promise<AbsenceActionResult> {
  try {
    const { userId, organizationId } = await requireManager();
    const db = await getDatabase();
    const absences = await db.listOrganizationAbsences(organizationId, {
      statuses: ["pending"],
    });
    const absence = absences.find((entry) => entry.id === id);
    if (!absence) return { ok: false, error: "NOT_FOUND" };

    if (approve) {
      const baseline = await listOverlapBaseline(organizationId, absence.employee_id);
      const candidate = absenceRequestToRange(absence);
      const overlap = findOverlappingAbsence(baseline, candidate, id);
      if (overlap) return { ok: false, error: "OVERLAP" };
    }

    await db.updateAbsenceRequest(id, organizationId, {
      employee_id: absence.employee_id,
      type: absence.type,
      start_date: absence.start_date,
      end_date: absence.end_date,
      is_open_ended: absence.is_open_ended,
      expected_end_date: absence.expected_end_date,
      status: approve ? "approved" : "rejected",
      notes: absence.notes,
      reviewed_by: userId,
      reported_by: absence.reported_by,
    });

    revalidatePath("/dashboard");
    revalidatePath("/planung");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Aktion fehlgeschlagen",
    };
  }
}

export async function closeOpenAbsence(
  id: string,
  endDate: string
): Promise<AbsenceActionResult> {
  try {
    const { userId, organizationId } = await requireManager();
    const db = await getDatabase();
    const absences = await db.listOrganizationAbsences(organizationId, {
      statuses: ["approved"],
    });
    const absence = absences.find((entry) => entry.id === id);
    if (!absence) return { ok: false, error: "NOT_FOUND" };
    if (!absence.is_open_ended) return { ok: false, error: "NOT_OPEN_ENDED" };

    const dateOrder = validateAbsenceDateOrder(
      absence.start_date,
      endDate,
      false
    );
    if (!dateOrder.ok) return { ok: false, error: "END_BEFORE_START" };

    await db.updateAbsenceRequest(id, organizationId, {
      employee_id: absence.employee_id,
      type: absence.type,
      start_date: absence.start_date,
      end_date: endDate,
      is_open_ended: false,
      expected_end_date: absence.expected_end_date,
      status: "approved",
      notes: absence.notes,
      reviewed_by: userId,
      reported_by: absence.reported_by,
    });

    revalidatePath("/dashboard");
    revalidatePath("/planung");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Aktion fehlgeschlagen",
    };
  }
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
