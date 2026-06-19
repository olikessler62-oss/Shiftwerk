"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  areaCalendarShiftsCacheTag,
  weekStartsForShiftCacheInvalidation,
} from "@/lib/cached-areacalendar-shifts";
import { getDatabase } from "@/lib/db";
import { requireSuperadminDeveloper } from "@/lib/superadmin-access";
import { shiftTimeFromTimestamp } from "@/lib/dates";
import type { SuperadminShiftListRow } from "@schichtwerk/database";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export type SuperadminShiftActionResult =
  | { ok: true }
  | { ok: false; errorKey: string };

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
  revalidatePath("/dashboard");
  revalidatePath("/bereich-kalender");

  if (!input.locationId) return;

  for (const weekStart of weekStartsForShiftCacheInvalidation(input.shiftDate)) {
    revalidateTag(
      areaCalendarShiftsCacheTag(input.organizationId, input.locationId, weekStart)
    );
  }
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
  } catch {
    return { ok: false, errorKey: "superadmin.errors.saveShiftStatusFailed" };
  }
}
