"use server";

import { revalidateAreaCalendarShiftCacheTags } from "@/lib/cached-areacalendar-shifts";
import { getAdminDatabase, getDatabase } from "@/lib/db";
import { requireSuperadminDeveloper } from "@/lib/superadmin-access";
import { shiftTimeFromTimestamp } from "@/lib/dates";
import type { SuperadminShiftListRow } from "@schichtwerk/database";
import {
  countFullConfirmationConflictCleanupItems,
  planConfirmationConflictCleanup,
  planDuplicateConfirmationShiftCleanup,
  type ConfirmationShiftCleanupRecord,
} from "@schichtwerk/database";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export type SuperadminShiftActionResult =
  | {
      ok: true;
      shiftCount?: number;
      savedAt?: string;
      restoredCount?: number;
      updatedCount?: number;
      cleanedCount?: number;
      conflictCount?: number;
    }
  | { ok: false; errorKey: string; error?: string };

function actionError(
  errorKey: string,
  error: unknown
): Extract<SuperadminShiftActionResult, { ok: false }> {
  return {
    ok: false,
    errorKey,
    error: error instanceof Error ? error.message : undefined,
  };
}

function formatLocationAreaLabel(
  locationName: string | null,
  areaName: string | null
): string {
  if (locationName && areaName) return `${locationName} / ${areaName}`;
  return locationName ?? areaName ?? "—";
}

function mapSuperadminShiftRow(
  row: Awaited<
    ReturnType<Awaited<ReturnType<typeof getDatabase>>["listOrganizationShiftsForSuperadmin"]>
  >[number],
  timeZone: string
): SuperadminShiftListRow {
  return {
    shiftId: row.id,
    shiftDate: row.shift_date,
    startTime: shiftTimeFromTimestamp(row.starts_at, timeZone),
    endTime: shiftTimeFromTimestamp(row.ends_at, timeZone),
    confirmationStatus: row.confirmation_status,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    locationName: row.location_name,
    areaName: row.area_name,
    templateName: row.template_name,
    locationAreaLabel: formatLocationAreaLabel(row.location_name, row.area_name),
  };
}

function revalidateShiftViews(input: {
  organizationId: string;
  locationId?: string | null;
  shiftDate: string;
}) {
  revalidateAreaCalendarShiftCacheTags({
    organizationId: input.organizationId,
    locationId: input.locationId,
    weekStarts: [input.shiftDate],
  });
}

export async function listSuperadminShifts(): Promise<
  SuperadminShiftListRow[] | { ok: false; errorKey: string }
> {
  try {
    const { organizationId, organization } = await requireSuperadminDeveloper();
    const db = await getDatabase();
    const rows = await db.listOrganizationShiftsForSuperadmin(organizationId);
    return rows.map((row) => mapSuperadminShiftRow(row, organization.timezone));
  } catch {
    return { ok: false, errorKey: "superadmin.errors.loadShiftsFailed" };
  }
}

export async function confirmAllSuperadminShiftStatuses(): Promise<SuperadminShiftActionResult> {
  try {
    const { organizationId, userId } = await requireSuperadminDeveloper();
    const db = await getDatabase();
    const rows = await db.listOrganizationShiftsForSuperadmin(organizationId);
    const shiftDates = new Set<string>();
    let updatedCount = 0;

    for (const row of rows) {
      if (row.confirmation_status === "confirmed") continue;
      const result = await db.updateShiftConfirmationStatusAsSuperadmin({
        organizationId,
        shiftId: row.id,
        actorId: userId,
        confirmationStatus: "confirmed",
      });
      shiftDates.add(result.shiftDate);
      updatedCount += 1;
    }

    if (shiftDates.size > 0) {
      revalidateAreaCalendarShiftCacheTags({
        organizationId,
        weekStarts: [...shiftDates],
      });
    }

    return { ok: true, updatedCount };
  } catch (error) {
    return actionError("superadmin.errors.confirmAllShiftStatusesFailed", error);
  }
}

export async function updateSuperadminShiftConfirmationStatus(input: {
  shiftId: string;
  confirmationStatus: ShiftConfirmationStatus;
}): Promise<SuperadminShiftActionResult> {
  try {
    const { organizationId, userId } = await requireSuperadminDeveloper();
    const db = await getDatabase();
    const result = await db.updateShiftConfirmationStatusAsSuperadmin({
      organizationId,
      shiftId: input.shiftId,
      actorId: userId,
      confirmationStatus: input.confirmationStatus,
    });

    revalidateShiftViews({
      organizationId,
      locationId: result.locationId,
      shiftDate: result.shiftDate,
    });

    return { ok: true };
  } catch (error) {
    return actionError("superadmin.errors.saveShiftStatusFailed", error);
  }
}

export async function getSuperadminShiftSnapshotMeta(): Promise<
  | { savedAt: string; shiftCount: number }
  | { ok: false; errorKey: string }
> {
  try {
    const { organizationId } = await requireSuperadminDeveloper();
    const admin = getAdminDatabase();
    const meta = await admin.getOrganizationShiftSnapshotMeta(organizationId);
    if (!meta) {
      return { savedAt: "", shiftCount: 0 };
    }
    return meta;
  } catch {
    return { ok: false, errorKey: "superadmin.errors.loadShiftSnapshotFailed" };
  }
}

export async function saveSuperadminShiftSnapshot(): Promise<SuperadminShiftActionResult> {
  try {
    const { organizationId } = await requireSuperadminDeveloper();
    const admin = getAdminDatabase();
    const shiftCount = await admin.saveOrganizationShiftSnapshot(organizationId);
    const meta = await admin.getOrganizationShiftSnapshotMeta(organizationId);
    return {
      ok: true,
      shiftCount,
      savedAt: meta?.savedAt,
    };
  } catch (error) {
    return actionError("superadmin.errors.saveShiftSnapshotFailed", error);
  }
}

function mapShiftRecordsForConflictCleanup(
  rows: Awaited<
    ReturnType<Awaited<ReturnType<typeof getDatabase>>["listOrganizationShiftsForSuperadmin"]>
  >
): ConfirmationShiftCleanupRecord[] {
  return rows.map((row) => ({
    id: row.id,
    employee_id: row.employee_id,
    shift_date: row.shift_date,
    location_area_id: row.location_area_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    confirmation_status: row.confirmation_status,
    confirmation_status_updated_at: row.confirmation_status_updated_at,
  }));
}

export async function previewSuperadminConfirmationConflictCleanup(): Promise<
  SuperadminShiftActionResult
> {
  try {
    const { organizationId } = await requireSuperadminDeveloper();
    const db = await getDatabase();
    const rows = await db.listOrganizationShiftsForSuperadmin(organizationId);
    const conflictCount = countFullConfirmationConflictCleanupItems(
      mapShiftRecordsForConflictCleanup(rows)
    );
    return { ok: true, conflictCount };
  } catch (error) {
    return actionError("superadmin.errors.cleanupConfirmationConflictsFailed", error);
  }
}

export async function cleanupSuperadminConfirmationConflicts(): Promise<
  SuperadminShiftActionResult
> {
  try {
    const { organizationId, userId } = await requireSuperadminDeveloper();
    const db = await getDatabase();
    let rows = await db.listOrganizationShiftsForSuperadmin(organizationId);
    let cleanupRecords = mapShiftRecordsForConflictCleanup(rows);
    const supersedePlan = planConfirmationConflictCleanup(cleanupRecords);

    if (!supersedePlan.length && !planDuplicateConfirmationShiftCleanup(cleanupRecords).length) {
      return { ok: true, cleanedCount: 0, conflictCount: 0 };
    }

    const shiftDates = new Set<string>();
    let cleanedCount = 0;

    for (const item of supersedePlan) {
      const result = await db.updateShiftConfirmationStatusAsSuperadmin({
        organizationId,
        shiftId: item.supersededShiftId,
        actorId: userId,
        confirmationStatus: "rejected",
      });
      shiftDates.add(result.shiftDate);
      cleanedCount += 1;
    }

    rows = await db.listOrganizationShiftsForSuperadmin(organizationId);
    cleanupRecords = mapShiftRecordsForConflictCleanup(rows);
    const duplicatePlan = planDuplicateConfirmationShiftCleanup(cleanupRecords);

    for (const item of duplicatePlan) {
      await db.deleteShift(item.duplicateShiftId, organizationId, userId);
      const kept = rows.find((row) => row.id === item.keepShiftId);
      if (kept) shiftDates.add(kept.shift_date);
      cleanedCount += 1;
    }

    if (shiftDates.size > 0) {
      revalidateAreaCalendarShiftCacheTags({
        organizationId,
        weekStarts: [...shiftDates],
      });
    }

    return {
      ok: true,
      cleanedCount,
      conflictCount: supersedePlan.length + duplicatePlan.length,
    };
  } catch (error) {
    return actionError("superadmin.errors.cleanupConfirmationConflictsFailed", error);
  }
}

export async function resetOrganizationShifts(input?: {
  deleteAllShifts?: boolean;
}): Promise<SuperadminShiftActionResult> {
  try {
    const { organizationId } = await requireSuperadminDeveloper();
    const admin = getAdminDatabase();
    const deleteAllShifts = input?.deleteAllShifts ?? false;
    await admin.resetOrganizationShiftData(organizationId, {
      deleteShifts: deleteAllShifts,
    });
    if (deleteAllShifts) {
      await admin.clearOrganizationShiftSnapshot(organizationId);
    }
    revalidateAreaCalendarShiftCacheTags({ organizationId });
    return { ok: true, restoredCount: 0 };
  } catch (error) {
    return actionError("superadmin.errors.resetShiftsFailed", error);
  }
}
