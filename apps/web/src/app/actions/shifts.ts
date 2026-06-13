"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { buildShiftTimestamps, shiftTimeFromTimestamp } from "@/lib/dates";
import {
  dashboardShiftsCacheTag,
  weekStartsForShiftCacheInvalidation,
} from "@/lib/cached-dashboard-shifts";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { shiftsOverlapIso } from "@/lib/shift-overlap";
import {
  dayAfter,
  dayBefore,
  DEFAULT_COUNTRY_CODE,
  resolveOrganizationTimeZone,
  validateRestPeriodForCountry,
  validateShiftDurationForCountry,
  validateEmployeeDayShiftAssignments,
  weekdayIndexFromDate,
} from "@schichtwerk/database";
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
import {
  loadShiftAssignValidationContext,
  mergeShiftAssignWarnings,
  validateShiftAssignEligibility,
} from "@/lib/shift-assign-validation";
import type { EmployeeShiftRecord } from "@schichtwerk/database";

export type ShiftActionResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; error: string };

type AssignShiftWithTimesInput = {
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  areaShiftTemplateId: string | null;
  locationId: string;
  locationAreaId: string | null;
};

export type AssignShiftBatchRowInput = {
  employeeId: string;
  startTime: string;
  endTime: string;
  areaShiftTemplateId: string | null;
};

export type AssignShiftBatchRowResult =
  | { rowIndex: number; ok: true; warnings?: string[] }
  | { rowIndex: number; ok: false; error: string };

export type AssignShiftBatchResult =
  | {
      ok: true;
      results: AssignShiftBatchRowResult[];
      undoAvailable: boolean;
      savedRowCount: number;
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

function pickAdjacentBoundaryShifts(
  dayBeforeShifts: EmployeeShiftRecord[],
  dayAfterShifts: EmployeeShiftRecord[],
  excludeIds: ReadonlySet<string>
): EmployeeShiftRecord[] {
  const boundary: EmployeeShiftRecord[] = [];
  const before = dayBeforeShifts.filter((shift) => !excludeIds.has(shift.id));
  const after = dayAfterShifts.filter((shift) => !excludeIds.has(shift.id));

  if (before.length > 0) {
    boundary.push(
      before.reduce((latest, shift) =>
        !latest || shift.ends_at > latest.ends_at ? shift : latest
      )
    );
  }

  if (after.length > 0) {
    boundary.push(
      after.reduce((earliest, shift) =>
        !earliest || shift.starts_at < earliest.starts_at ? shift : earliest
      )
    );
  }

  return boundary;
}

async function validateShiftLaborCompliance(
  organizationId: string,
  employeeId: string,
  shiftDate: string,
  startTime: string,
  endTime: string,
  timeZone: string,
  options?: { sameDayBatchPeerCount?: number }
): Promise<{ ok: true; warnings?: string[] } | { ok: false; error: string }> {
  const db = await getDatabase();
  const countryCode =
    (await db.getOrganizationCountryCode(organizationId)) ?? DEFAULT_COUNTRY_CODE;
  const weekday = weekdayIndexFromDate(shiftDate);

  const durationCheck = validateShiftDurationForCountry({
    countryCode,
    start_time: startTime,
    end_time: endTime,
    weekday,
    shiftDate,
    point: "shift_assign",
  });
  if (!durationCheck.ok) return durationCheck;

  const { starts_at, ends_at } = buildShiftTimestamps(
    shiftDate,
    startTime,
    endTime,
    timeZone
  );
  const sameDay = await db.listShiftsForEmployeeDate(employeeId, shiftDate);
  const overlappingIds = new Set(
    findOverlappingShifts(sameDay, starts_at, ends_at).map((shift) => shift.id)
  );
  const otherSameDayCount = sameDay.filter(
    (shift) => !overlappingIds.has(shift.id)
  ).length;
  const isSplitDutyDay =
    otherSameDayCount > 0 || (options?.sameDayBatchPeerCount ?? 0) > 0;

  if (isSplitDutyDay) {
    return {
      ok: true,
      warnings: durationCheck.warnings.length ? durationCheck.warnings : undefined,
    };
  }

  const [dayBeforeShifts, dayAfterShifts] = await Promise.all([
    db.listShiftsForEmployeeDate(employeeId, dayBefore(shiftDate)),
    db.listShiftsForEmployeeDate(employeeId, dayAfter(shiftDate)),
  ]);

  const restCheck = validateRestPeriodForCountry({
    countryCode,
    newStartsAt: starts_at,
    newEndsAt: ends_at,
    newShiftDate: shiftDate,
    timeZone,
    existingShifts: pickAdjacentBoundaryShifts(
      dayBeforeShifts,
      dayAfterShifts,
      overlappingIds
    ),
  });
  if (!restCheck.ok) return restCheck;

  return {
    ok: true,
    warnings: durationCheck.warnings.length ? durationCheck.warnings : undefined,
  };
}

async function persistShiftWithTimes(
  organizationId: string,
  userId: string,
  input: AssignShiftWithTimesInput,
  undoBatch: ShiftAssignUndoBatch,
  timeZone: string
): Promise<void> {
  const db = await getDatabase();

  if (!areDashboardShiftTimesComplete(input.startTime, input.endTime)) {
    throw new Error("Ungültige Schichtzeiten.");
  }

  const { starts_at, ends_at } = buildShiftTimestamps(
    input.shiftDate,
    input.startTime,
    input.endTime,
    timeZone
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
  locationAreaId: string | null,
  requireArea: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isPastShiftDate(shiftDate)) {
    return { ok: false, error: "Vergangene Tage können nicht mehr geplant werden." };
  }

  const db = await getDatabase();
  const locations = await db.listLocations(organizationId);
  if (!locations.some((l) => l.id === locationId)) {
    return { ok: false, error: "Standort nicht gefunden" };
  }

  if (requireArea) {
    if (!locationAreaId) {
      return { ok: false, error: "Bereich nicht gefunden" };
    }
    const areas = await db.listLocationAreas(locationId);
    if (!areas.some((a) => a.id === locationAreaId)) {
      return { ok: false, error: "Bereich nicht gefunden" };
    }
  }

  const profile = await db.getProfileById(employeeId);
  if (!profileCanReceiveShiftAssignment(profile, organizationId)) {
    return { ok: false, error: "Personal nicht gefunden" };
  }

  return { ok: true };
}

function revalidateShiftPaths(scope?: {
  organizationId: string;
  locationId: string;
  shiftDates: string[];
}) {
  revalidatePath("/planung");
  revalidatePath("/dashboard");

  if (!scope?.locationId) return;

  const tags = new Set<string>();
  for (const shiftDate of scope.shiftDates) {
    for (const weekStart of weekStartsForShiftCacheInvalidation(shiftDate)) {
      tags.add(
        dashboardShiftsCacheTag(
          scope.organizationId,
          scope.locationId,
          weekStart
        )
      );
    }
  }
  for (const tag of tags) {
    revalidateTag(tag);
  }
}

function revalidateShiftPathsFromUndoBatch(
  organizationId: string,
  batch: ShiftAssignUndoBatch
) {
  const shiftDates = new Set<string>();
  let locationId: string | undefined;

  for (const snapshot of batch.replacements) {
    shiftDates.add(snapshot.shift_date);
    if (snapshot.location_id) locationId = snapshot.location_id;
  }

  if (!locationId || shiftDates.size === 0) {
    revalidateShiftPaths();
    return;
  }

  revalidateShiftPaths({
    organizationId,
    locationId,
    shiftDates: [...shiftDates],
  });
}

export async function assignShiftWithTimes(
  input: AssignShiftWithTimesInput
): Promise<ShiftActionResult> {
  try {
    const { organizationId, userId, orgFeatures, organization } =
      await requireManager();
    const context = await validateAssignContext(
      organizationId,
      input.employeeId,
      input.shiftDate,
      input.locationId,
      input.locationAreaId,
      orgFeatures.areas
    );
    if (!context.ok) return context;

    const db = await getDatabase();
    const assignCtx = await loadShiftAssignValidationContext(
      db,
      organizationId,
      organization.planning_mode,
      input.locationId,
      input.locationAreaId
    );
    const eligibilityCheck = validateShiftAssignEligibility(
      organization.planning_mode,
      assignCtx,
      {
        employeeId: input.employeeId,
        shiftDate: input.shiftDate,
        startTime: input.startTime,
        endTime: input.endTime,
        locationAreaId: input.locationAreaId,
      }
    );
    if (!eligibilityCheck.ok) return eligibilityCheck;
    const assignWarnings = eligibilityCheck.warnings;

    const timeZone = resolveOrganizationTimeZone(organization);

    const laborCheck = await validateShiftLaborCompliance(
      organizationId,
      input.employeeId,
      input.shiftDate,
      input.startTime,
      input.endTime,
      timeZone
    );
    if (!laborCheck.ok) return laborCheck;

    const undoBatch: ShiftAssignUndoBatch = {
      createdIds: [],
      deletedIds: [],
      replacements: [],
    };

    await persistShiftWithTimes(organizationId, userId, input, undoBatch, timeZone);
    setShiftAssignUndoBatch(userId, undoBatch);
    revalidateShiftPaths({
      organizationId,
      locationId: input.locationId,
      shiftDates: [input.shiftDate],
    });

    return {
      ok: true,
      warnings: mergeShiftAssignWarnings(assignWarnings, laborCheck.warnings),
    };
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
  deleteShiftIds?: string[];
}): Promise<AssignShiftBatchResult> {
  try {
    const { organizationId, userId, organization } = await requireManager();
    const timeZone = resolveOrganizationTimeZone(organization);
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

    const deleteShiftIds = [...new Set(input.deleteShiftIds ?? [])];
    for (const shiftId of deleteShiftIds) {
      const shift = await db.getShiftRecordById(shiftId, organizationId);
      if (!shift) {
        return { ok: false, error: "Schicht nicht gefunden" };
      }
      if (shift.location_area_id !== input.locationAreaId) {
        return { ok: false, error: "Schicht gehört nicht zu diesem Bereich" };
      }
      if (shift.shift_date !== input.shiftDate) {
        return { ok: false, error: "Schicht gehört nicht zu diesem Tag" };
      }
      if (isPastShiftDate(shift.shift_date)) {
        return {
          ok: false,
          error: "Vergangene Schichten können nicht mehr entfernt werden.",
        };
      }
    }

    const assignCtx = await loadShiftAssignValidationContext(
      db,
      organizationId,
      organization.planning_mode,
      input.locationId,
      input.locationAreaId
    );

    type ValidRow = AssignShiftBatchRowInput & {
      rowIndex: number;
      starts_at: string;
      ends_at: string;
      warnings?: string[];
    };

    const validRows: ValidRow[] = [];
    const results: AssignShiftBatchRowResult[] = [];

    const completeBatchRows = input.rows
      .map((row, rowIndex) => ({ row, rowIndex }))
      .filter(
        ({ row }) =>
          row.employeeId &&
          areDashboardShiftTimesComplete(row.startTime, row.endTime)
      );
    const batchPeerCountByEmployee = new Map<string, number>();
    for (const { row } of completeBatchRows) {
      batchPeerCountByEmployee.set(
        row.employeeId,
        (batchPeerCountByEmployee.get(row.employeeId) ?? 0) + 1
      );
    }

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
        input.locationAreaId,
        true
      );
      if (!context.ok) {
        results.push({ rowIndex, ok: false, error: context.error });
        continue;
      }

      const eligibilityCheck = validateShiftAssignEligibility(
        "advanced",
        assignCtx,
        {
          employeeId: row.employeeId,
          shiftDate: input.shiftDate,
          startTime: row.startTime,
          endTime: row.endTime,
          locationAreaId: input.locationAreaId,
        }
      );
      if (!eligibilityCheck.ok) {
        results.push({ rowIndex, ok: false, error: eligibilityCheck.error });
        continue;
      }

      const laborCheck = await validateShiftLaborCompliance(
        organizationId,
        row.employeeId,
        input.shiftDate,
        row.startTime,
        row.endTime,
        timeZone,
        {
          sameDayBatchPeerCount:
            (batchPeerCountByEmployee.get(row.employeeId) ?? 1) - 1,
        }
      );
      if (!laborCheck.ok) {
        results.push({ rowIndex, ok: false, error: laborCheck.error });
        continue;
      }

      const { starts_at, ends_at } = buildShiftTimestamps(
        input.shiftDate,
        row.startTime,
        row.endTime,
        timeZone
      );

      validRows.push({
        ...row,
        rowIndex,
        starts_at,
        ends_at,
        warnings: mergeShiftAssignWarnings(
          eligibilityCheck.warnings,
          laborCheck.warnings
        ),
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

    const countryCode =
      (await db.getOrganizationCountryCode(organizationId)) ?? DEFAULT_COUNTRY_CODE;
    const weekday = weekdayIndexFromDate(input.shiftDate);
    const rowsByEmployee = new Map<string, ValidRow[]>();
    for (const row of validRows) {
      const group = rowsByEmployee.get(row.employeeId) ?? [];
      group.push(row);
      rowsByEmployee.set(row.employeeId, group);
    }

    for (const [employeeId, employeeRows] of rowsByEmployee) {
      const modalWindows = employeeRows.map((row) => ({
        startTime: row.startTime,
        endTime: row.endTime,
      }));
      if (modalWindows.length < 2) continue;

      const existingDayShifts = await db.listShiftsForEmployeeDate(
        employeeId,
        input.shiftDate
      );
      const externalWindows = existingDayShifts
        .filter((shift) => shift.location_area_id !== input.locationAreaId)
        .map((shift) => ({
          startTime: shiftTimeFromTimestamp(shift.starts_at, timeZone),
          endTime: shiftTimeFromTimestamp(shift.ends_at, timeZone),
        }));

      const dayCheck = validateEmployeeDayShiftAssignments({
        countryCode,
        shiftDate: input.shiftDate,
        weekday,
        windows: [...modalWindows, ...externalWindows],
      });

      if (!dayCheck.ok) {
        for (const row of employeeRows) {
          results.push({
            rowIndex: row.rowIndex,
            ok: false,
            error: dayCheck.error,
          });
        }
        const blocked = new Set(employeeRows.map((row) => row.rowIndex));
        for (let i = validRows.length - 1; i >= 0; i--) {
          if (blocked.has(validRows[i]!.rowIndex)) {
            validRows.splice(i, 1);
          }
        }
      }
    }

    const undoBatch: ShiftAssignUndoBatch = {
      createdIds: [],
      deletedIds: [],
      replacements: [],
    };

    let anySuccess = false;

    for (const shiftId of deleteShiftIds) {
      const snapshot = await db.getShiftRecordById(shiftId, organizationId);
      if (!snapshot) continue;
      undoBatch.replacements.push(toUndoSnapshot(snapshot));
      await db.deleteShift(shiftId, organizationId);
      undoBatch.deletedIds.push(shiftId);
      anySuccess = true;
    }

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
          undoBatch,
          timeZone
        );
        results.push({ rowIndex: row.rowIndex, ok: true, warnings: row.warnings });
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
      revalidateShiftPaths({
        organizationId,
        locationId: input.locationId,
        shiftDates: [input.shiftDate],
      });
    }

    return {
      ok: true,
      results,
      undoAvailable: anySuccess,
      savedRowCount: results.filter((entry) => entry.ok).length,
    };
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

    revalidateShiftPathsFromUndoBatch(organizationId, batch);
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

    const shift = await db.getShiftRecordById(shiftId, organizationId);
    if (!shift) {
      return { ok: false, error: "Schicht nicht gefunden" };
    }
    if (isPastShiftDate(shift.shift_date)) {
      return { ok: false, error: "Vergangene Schichten können nicht mehr entfernt werden." };
    }

    await db.deleteShift(shiftId, organizationId);

    if (shift.location_id) {
      revalidateShiftPaths({
        organizationId,
        locationId: shift.location_id,
        shiftDates: [shift.shift_date],
      });
    } else {
      revalidateShiftPaths();
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unbekannter Fehler",
    };
  }
}
