"use server";

import { revalidatePath } from "next/cache";
import { buildShiftTimestamps } from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { shiftsOverlapIso } from "@/lib/shift-overlap";
import {
  setShiftAssignUndoBatch,
  takeShiftAssignUndoBatch,
  type ShiftAssignUndoBatch,
  type ShiftUndoSnapshot,
} from "@/lib/shift-assign-undo-store";
import {
  areDashboardShiftTimesComplete,
  profileCanReceiveShiftAssignment,
} from "@/lib/available-employees-for-shift";
import { validateDashboardShiftServiceHours } from "@/lib/service-hours-shift-validation";
import type { EmployeeShiftRecord } from "@schichtwerk/database";
import type { LocationAreaServiceHour } from "@schichtwerk/types";

export type ShiftActionResult =
  | { ok: true }
  | { ok: false; error: string };

type AssignShiftWithTimesInput = {
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  areaShiftTemplateId: string | null;
  locationId: string;
  locationAreaId: string;
};

export type AssignShiftBatchRowInput = {
  employeeId: string;
  startTime: string;
  endTime: string;
  areaShiftTemplateId: string | null;
};

export type AssignShiftBatchRowResult =
  | { rowIndex: number; ok: true }
  | { rowIndex: number; ok: false; error: string };

export type AssignShiftBatchResult =
  | {
      ok: true;
      results: AssignShiftBatchRowResult[];
      undoAvailable: boolean;
    }
  | { ok: false; error: string };

function toUndoSnapshot(row: EmployeeShiftRecord): ShiftUndoSnapshot {
  return {
    id: row.id,
    employee_id: row.employee_id,
    area_shift_template_id: row.area_shift_template_id,
    location_id: row.location_id,
    location_area_id: row.location_area_id,
    shift_date: row.shift_date,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    created_by: row.created_by,
  };
}

function findOverlappingShifts(
  existing: EmployeeShiftRecord[],
  startsAt: string,
  endsAt: string
): EmployeeShiftRecord[] {
  return existing.filter((shift) =>
    shiftsOverlapIso(shift.starts_at, shift.ends_at, startsAt, endsAt)
  );
}

async function persistShiftWithTimes(
  organizationId: string,
  userId: string,
  input: AssignShiftWithTimesInput,
  undoBatch: ShiftAssignUndoBatch
): Promise<void> {
  const db = await getDatabase();

  if (!areDashboardShiftTimesComplete(input.startTime, input.endTime)) {
    throw new Error("Ungültige Schichtzeiten.");
  }

  const { starts_at, ends_at } = buildShiftTimestamps(
    input.shiftDate,
    input.startTime,
    input.endTime
  );

  const existing = await db.listShiftsForEmployeeDate(
    input.employeeId,
    input.shiftDate
  );
  const overlapping = findOverlappingShifts(existing, starts_at, ends_at);

  const payload = {
    area_shift_template_id: input.areaShiftTemplateId,
    location_id: input.locationId,
    location_area_id: input.locationAreaId,
    starts_at,
    ends_at,
    created_by: userId,
  };

  if (overlapping.length > 0) {
    const primary = overlapping[0];
    const snapshot = await db.getShiftRecordById(primary.id, organizationId);
    if (snapshot) {
      undoBatch.replacements.push(toUndoSnapshot(snapshot));
    }
    await db.updateShift(primary.id, payload);

    for (let i = 1; i < overlapping.length; i++) {
      const extra = overlapping[i];
      const extraSnapshot = await db.getShiftRecordById(extra.id, organizationId);
      if (extraSnapshot) {
        undoBatch.replacements.push(toUndoSnapshot(extraSnapshot));
      }
      await db.deleteShift(extra.id, organizationId);
      undoBatch.deletedIds.push(extra.id);
    }
    return;
  }

  const { id } = await db.insertShift({
    organization_id: organizationId,
    employee_id: input.employeeId,
    shift_date: input.shiftDate,
    ...payload,
  });
  undoBatch.createdIds.push(id);
}

async function validateAssignContext(
  organizationId: string,
  employeeId: string,
  shiftDate: string,
  locationId: string,
  locationAreaId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isPastShiftDate(shiftDate)) {
    return { ok: false, error: "Vergangene Tage können nicht mehr geplant werden." };
  }

  const db = await getDatabase();
  const locations = await db.listLocations(organizationId);
  if (!locations.some((l) => l.id === locationId)) {
    return { ok: false, error: "Standort nicht gefunden" };
  }

  const areas = await db.listLocationAreas(locationId);
  if (!areas.some((a) => a.id === locationAreaId)) {
    return { ok: false, error: "Bereich nicht gefunden" };
  }

  const profile = await db.getProfileById(employeeId);
  if (!profileCanReceiveShiftAssignment(profile, organizationId)) {
    return { ok: false, error: "Mitarbeiter nicht gefunden" };
  }

  return { ok: true };
}

function revalidateShiftPaths() {
  revalidatePath("/planung");
  revalidatePath("/dashboard");
}

export async function assignShiftWithTimes(
  input: AssignShiftWithTimesInput
): Promise<ShiftActionResult> {
  try {
    const { organizationId, userId } = await requireManager();
    const context = await validateAssignContext(
      organizationId,
      input.employeeId,
      input.shiftDate,
      input.locationId,
      input.locationAreaId
    );
    if (!context.ok) return context;

    const db = await getDatabase();

    const areaServiceHours = await db.listLocationAreaServiceHoursForArea(
      input.locationAreaId,
      input.locationId
    );
    const serviceHoursCheck = validateDashboardShiftServiceHours(
      areaServiceHours,
      input.locationAreaId,
      input.shiftDate,
      input.startTime,
      input.endTime
    );
    if (!serviceHoursCheck.ok) return serviceHoursCheck;

    const undoBatch: ShiftAssignUndoBatch = {
      createdIds: [],
      deletedIds: [],
      replacements: [],
    };

    await persistShiftWithTimes(organizationId, userId, input, undoBatch);
    setShiftAssignUndoBatch(userId, undoBatch);
    revalidateShiftPaths();

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unbekannter Fehler",
    };
  }
}

export async function assignShiftBatch(input: {
  shiftDate: string;
  locationId: string;
  locationAreaId: string;
  rows: AssignShiftBatchRowInput[];
}): Promise<AssignShiftBatchResult> {
  try {
    const { organizationId, userId } = await requireManager();
    const db = await getDatabase();

    if (isPastShiftDate(input.shiftDate)) {
      return { ok: false, error: "Vergangene Tage können nicht mehr geplant werden." };
    }

    const locations = await db.listLocations(organizationId);
    if (!locations.some((l) => l.id === input.locationId)) {
      return { ok: false, error: "Standort nicht gefunden" };
    }

    const areas = await db.listLocationAreas(input.locationId);
    if (!areas.some((a) => a.id === input.locationAreaId)) {
      return { ok: false, error: "Bereich nicht gefunden" };
    }

    const areaServiceHours: LocationAreaServiceHour[] =
      await db.listLocationAreaServiceHoursForArea(
        input.locationAreaId,
        input.locationId
      );

    type ValidRow = AssignShiftBatchRowInput & {
      rowIndex: number;
      starts_at: string;
      ends_at: string;
    };

    const validRows: ValidRow[] = [];
    const results: AssignShiftBatchRowResult[] = [];

    for (let rowIndex = 0; rowIndex < input.rows.length; rowIndex++) {
      const row = input.rows[rowIndex];
      if (
        !row.employeeId ||
        !areDashboardShiftTimesComplete(row.startTime, row.endTime)
      ) {
        continue;
      }

      const context = await validateAssignContext(
        organizationId,
        row.employeeId,
        input.shiftDate,
        input.locationId,
        input.locationAreaId
      );
      if (!context.ok) {
        results.push({ rowIndex, ok: false, error: context.error });
        continue;
      }

      const serviceHoursCheck = validateDashboardShiftServiceHours(
        areaServiceHours,
        input.locationAreaId,
        input.shiftDate,
        row.startTime,
        row.endTime
      );
      if (!serviceHoursCheck.ok) {
        results.push({ rowIndex, ok: false, error: serviceHoursCheck.error });
        continue;
      }

      const { starts_at, ends_at } = buildShiftTimestamps(
        input.shiftDate,
        row.startTime,
        row.endTime
      );

      validRows.push({
        ...row,
        rowIndex,
        starts_at,
        ends_at,
      });
    }

    for (let i = 0; i < validRows.length; i++) {
      for (let j = 0; j < i; j++) {
        if (validRows[i].employeeId !== validRows[j].employeeId) continue;
        if (
          shiftsOverlapIso(
            validRows[i].starts_at,
            validRows[i].ends_at,
            validRows[j].starts_at,
            validRows[j].ends_at
          )
        ) {
          results.push({
            rowIndex: validRows[i].rowIndex,
            ok: false,
            error: "Überschneidung mit anderer Zeile im Batch.",
          });
          validRows.splice(i, 1);
          i -= 1;
          break;
        }
      }
    }

    const undoBatch: ShiftAssignUndoBatch = {
      createdIds: [],
      deletedIds: [],
      replacements: [],
    };

    let anySuccess = false;

    for (const row of validRows) {
      if (results.some((r) => !r.ok && r.rowIndex === row.rowIndex)) continue;

      try {
        await persistShiftWithTimes(
          organizationId,
          userId,
          {
            employeeId: row.employeeId,
            shiftDate: input.shiftDate,
            startTime: row.startTime,
            endTime: row.endTime,
            areaShiftTemplateId: row.areaShiftTemplateId,
            locationId: input.locationId,
            locationAreaId: input.locationAreaId,
          },
          undoBatch
        );
        results.push({ rowIndex: row.rowIndex, ok: true });
        anySuccess = true;
      } catch (e) {
        results.push({
          rowIndex: row.rowIndex,
          ok: false,
          error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
        });
      }
    }

    if (anySuccess) {
      setShiftAssignUndoBatch(userId, undoBatch);
      revalidateShiftPaths();
    }

    return { ok: true, results, undoAvailable: anySuccess };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unbekannter Fehler",
    };
  }
}

export async function undoLastShiftAssignBatch(): Promise<ShiftActionResult> {
  try {
    const { organizationId, userId } = await requireManager();
    const batch = takeShiftAssignUndoBatch(userId);
    if (!batch) {
      return { ok: false, error: "Kein Rückgängig-Schritt verfügbar." };
    }

    const db = await getDatabase();

    for (const snapshot of batch.replacements) {
      await db.updateShift(snapshot.id, {
        area_shift_template_id: snapshot.area_shift_template_id,
        location_id: snapshot.location_id ?? "",
        location_area_id: snapshot.location_area_id,
        starts_at: snapshot.starts_at,
        ends_at: snapshot.ends_at,
        created_by: snapshot.created_by ?? userId,
      });
    }

    for (const id of batch.createdIds) {
      await db.deleteShift(id, organizationId);
    }

    for (const id of batch.deletedIds) {
      const snapshot = batch.replacements.find((row) => row.id === id);
      if (!snapshot || !snapshot.location_id) continue;
      await db.insertShift({
        organization_id: organizationId,
        employee_id: snapshot.employee_id,
        area_shift_template_id: snapshot.area_shift_template_id,
        location_id: snapshot.location_id,
        location_area_id: snapshot.location_area_id,
        shift_date: snapshot.shift_date,
        starts_at: snapshot.starts_at,
        ends_at: snapshot.ends_at,
        created_by: snapshot.created_by ?? userId,
      });
    }

    revalidateShiftPaths();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Rückgängig fehlgeschlagen",
    };
  }
}

export async function removeShift(shiftId: string): Promise<ShiftActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const shift = await db.getShiftById(shiftId, organizationId);
    if (!shift) {
      return { ok: false, error: "Schicht nicht gefunden" };
    }
    if (isPastShiftDate(shift.shift_date)) {
      return { ok: false, error: "Vergangene Schichten können nicht mehr entfernt werden." };
    }

    await db.deleteShift(shiftId, organizationId);

    revalidateShiftPaths();

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unbekannter Fehler",
    };
  }
}
