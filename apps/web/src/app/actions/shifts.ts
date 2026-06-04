"use server";

import { revalidatePath } from "next/cache";
import { buildShiftTimestamps } from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type ShiftActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function assignShift(
  employeeId: string,
  shiftDate: string,
  shiftTypeId: string
): Promise<ShiftActionResult> {
  try {
    const { organizationId, userId } = await requireManager();
    const db = await getDatabase();

    const shiftType = await db.getShiftTypeForAssign(shiftTypeId, organizationId);
    if (!shiftType) {
      return { ok: false, error: "Schichttyp nicht gefunden" };
    }

    const profile = await db.getProfileById(employeeId);
    if (
      !profile ||
      profile.organization_id !== organizationId ||
      profile.role !== "employee" ||
      !profile.is_active
    ) {
      return { ok: false, error: "Mitarbeiter nicht gefunden" };
    }

    const { starts_at, ends_at } = buildShiftTimestamps(
      shiftDate,
      shiftType.start_time,
      shiftType.end_time
    );

    const existing = await db.findShiftByEmployeeDate(employeeId, shiftDate);

    if (existing) {
      await db.updateShift(existing.id, {
        shift_type_id: shiftTypeId,
        starts_at,
        ends_at,
        created_by: userId,
      });
    } else {
      await db.insertShift({
        organization_id: organizationId,
        employee_id: employeeId,
        shift_type_id: shiftTypeId,
        shift_date: shiftDate,
        starts_at,
        ends_at,
        created_by: userId,
      });
    }

    revalidatePath("/planung");
    revalidatePath("/dashboard");

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unbekannter Fehler",
    };
  }
}

export async function removeShift(shiftId: string): Promise<ShiftActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    await db.deleteShift(shiftId, organizationId);

    revalidatePath("/planung");
    revalidatePath("/dashboard");

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unbekannter Fehler",
    };
  }
}
