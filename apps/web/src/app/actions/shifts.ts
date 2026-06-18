"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { buildShiftTimestamps, shiftTimeFromTimestamp } from "@/lib/dates";
import {
  dashboardShiftsCacheTag,
  weekStartsForShiftCacheInvalidation,
} from "@/lib/cached-dashboard-shifts";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import { resolveSimulatedProposedAssignOptions } from "@/lib/shift-confirmation-assign-mode";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { shiftsOverlapIso } from "@/lib/shift-overlap";
import {
  DEFAULT_COUNTRY_CODE,
  resolveConfirmationAssignPatch,
  resolveOrganizationTimeZone,
  validateProfileForShiftConfirmationAssign,
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
  withoutServiceHours?: boolean;
  /** Bestehende Schicht per ID aktualisieren (Mehrfach-Schichten pro Tag). */
  existingShiftId?: string;
  /** Superadmin-Simulation: Zuweisungen als proposed speichern. */
  simulatedProposedOnAssign?: boolean;
};

function buildAssignSnapshotSource(
  input: AssignShiftWithTimesInput,
  starts_at: string,
  ends_at: string
) {
  return {
    employee_id: input.employeeId,
    location_id: input.locationId,
    location_area_id: input.locationAreaId,
    area_shift_template_id: input.areaShiftTemplateId,
    shift_date: input.shiftDate,
    starts_at,
    ends_at,
    notes: null as string | null,
  };
}

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

async function validateShiftLaborCompliance(
  organizationId: string,
  employeeId: string,
  shiftDate: string,
  startTime: string,
  endTime: string,
  timeZone: string,
  options?: { sameDayBatchPeerCount?: number; excludeShiftIds?: ReadonlySet<string> }
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
  const excludeIds = options?.excludeShiftIds ?? new Set<string>();
  const sameDay = (await db.listShiftsForEmployeeDate(employeeId, shiftDate)).filter(
    (shift) => !excludeIds.has(shift.id)
  );
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

  const restShifts = (
    await db.listShiftsForEmployeeRestCheck(
      employeeId,
      starts_at,
      ends_at,
      shiftDate
    )
  ).filter((shift) => !excludeIds.has(shift.id) && !overlappingIds.has(shift.id));

  const restCheck = validateRestPeriodForCountry({
    countryCode,
    newStartsAt: starts_at,
    newEndsAt: ends_at,
    newShiftDate: shiftDate,
    timeZone,
    existingShifts: restShifts,
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
  timeZone: string,
  shiftConfirmationEnabled: boolean
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

  const nextSnapshot = buildAssignSnapshotSource(input, starts_at, ends_at);

  const payload = {
    area_shift_template_id: input.areaShiftTemplateId,
    location_id: input.locationId,
    location_area_id: input.locationAreaId,
    starts_at,
    ends_at,
    created_by: userId,
  };

  if (input.existingShiftId) {
    const snapshot = await db.getShiftRecordById(
      input.existingShiftId,
      organizationId
    );
    if (!snapshot) {
      throw new Error("Schicht nicht gefunden.");
    }

    const sameDay = await db.listShiftsForEmployeeDate(
      input.employeeId,
      input.shiftDate
    );
    const otherShifts = sameDay.filter((shift) => shift.id !== input.existingShiftId);
    const overlapping = findOverlappingShifts(otherShifts, starts_at, ends_at);
    if (overlapping.length > 0) {
      throw new Error("Schichtzeiten überschneiden sich mit einer anderen Schicht.");
    }

    undoBatch.replacements.push(toUndoSnapshot(snapshot));
    const confirmationPatch = resolveConfirmationAssignPatch({
      shiftConfirmationEnabled,
      existing: snapshot,
      next: nextSnapshot,
    });
    await db.updateShift(input.existingShiftId, { ...payload, ...confirmationPatch });
    return;
  }

  const existing = await db.listShiftsForEmployeeDate(
    input.employeeId,
    input.shiftDate
  );
  const overlapping = findOverlappingShifts(existing, starts_at, ends_at);

  if (overlapping.length > 0) {
    const primary = overlapping[0];
    const snapshot = await db.getShiftRecordById(primary.id, organizationId);
    if (snapshot) {
      undoBatch.replacements.push(toUndoSnapshot(snapshot));
    }
    const confirmationPatch = resolveConfirmationAssignPatch({
      shiftConfirmationEnabled,
      existing: snapshot,
      next: nextSnapshot,
    });
    await db.updateShift(primary.id, { ...payload, ...confirmationPatch });

    for (let i = 1; i < overlapping.length; i++) {
      const extra = overlapping[i];
      const extraSnapshot = await db.getShiftRecordById(extra.id, organizationId);
      if (extraSnapshot) {
        undoBatch.replacements.push(toUndoSnapshot(extraSnapshot));
      }
      await db.deleteShift(extra.id, organizationId, userId);
      undoBatch.deletedIds.push(extra.id);
    }
    return;
  }

  const confirmationPatch = resolveConfirmationAssignPatch({
    shiftConfirmationEnabled,
    existing: null,
    next: nextSnapshot,
  });

  const { id } = await db.insertShift({
    organization_id: organizationId,
    employee_id: input.employeeId,
    shift_date: input.shiftDate,
    ...payload,
    ...confirmationPatch,
  });
  undoBatch.createdIds.push(id);
}

async function validateAssignContext(
  organizationId: string,
  employeeId: string,
  shiftDate: string,
  locationId: string,
  locationAreaId: string | null,
  requireArea: boolean,
  shiftConfirmationEnabled: boolean,
  relaxAppRegistrationGate = false
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
  const gate = validateProfileForShiftConfirmationAssign(
    profile,
    organizationId,
    shiftConfirmationEnabled,
    { relaxAppRegistrationGate }
  );
  if (!gate.ok) return gate;

  return { ok: true };
}

function revalidateShiftPaths(scope?: {
  organizationId: string;
  locationId: string;
  shiftDates: string[];
}) {
  revalidatePath("/planer");
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
    const { organizationId, userId, orgFeatures, organization, profile } =
      await requireManager();
    const assignMode = resolveSimulatedProposedAssignOptions({
      organizationEnabled: organization.shift_confirmation_enabled,
      simulatedProposedOnAssign: input.simulatedProposedOnAssign,
      managerEmail: profile.email,
    });
    const context = await validateAssignContext(
      organizationId,
      input.employeeId,
      input.shiftDate,
      input.locationId,
      input.locationAreaId,
      orgFeatures.areas,
      assignMode.shiftConfirmationEnabled,
      assignMode.relaxAppRegistrationGate
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
        withoutServiceHours: input.withoutServiceHours,
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
      timeZone,
      input.existingShiftId
        ? { excludeShiftIds: new Set([input.existingShiftId]) }
        : undefined
    );
    if (!laborCheck.ok) return laborCheck;

    const undoBatch: ShiftAssignUndoBatch = {
      createdIds: [],
      deletedIds: [],
      replacements: [],
    };

    await persistShiftWithTimes(
      organizationId,
      userId,
      input,
      undoBatch,
      timeZone,
      assignMode.shiftConfirmationEnabled
    );
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
  withoutServiceHours?: boolean;
  simulatedProposedOnAssign?: boolean;
}): Promise<AssignShiftBatchResult> {
  try {
    const { organizationId, userId, organization, profile } = await requireManager();
    const assignMode = resolveSimulatedProposedAssignOptions({
      organizationEnabled: organization.shift_confirmation_enabled,
      simulatedProposedOnAssign: input.simulatedProposedOnAssign,
      managerEmail: profile.email,
    });
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
    const excludeShiftIds = new Set(deleteShiftIds);
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
        true,
        assignMode.shiftConfirmationEnabled,
        assignMode.relaxAppRegistrationGate
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
          withoutServiceHours: input.withoutServiceHours,
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
          excludeShiftIds,
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
      await db.deleteShift(shiftId, organizationId, userId);
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
          timeZone,
          assignMode.shiftConfirmationEnabled
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
      await db.deleteShift(id, organizationId, userId);
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
    const { organizationId, userId } = await requireManager();
    const db = await getDatabase();

    const shift = await db.getShiftRecordById(shiftId, organizationId);
    if (!shift) {
      return { ok: false, error: "Schicht nicht gefunden" };
    }
    if (isPastShiftDate(shift.shift_date)) {
      return { ok: false, error: "Vergangene Schichten können nicht mehr entfernt werden." };
    }

    await db.deleteShift(shiftId, organizationId, userId);

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
