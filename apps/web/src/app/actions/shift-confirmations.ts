"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  dashboardShiftsCacheTag,
  weekStartsForShiftCacheInvalidation,
} from "@/lib/cached-dashboard-shifts";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import {
  filterSendableProposedShifts,
  filterShiftsForConfirmationSendScope,
  isoWeekEndFromWeekStart,
  isShiftEligibleForConfirmationSend,
  profileEligibleForShiftConfirmationAssignment,
} from "@schichtwerk/database";
import type { ConfirmationRequestScope } from "@schichtwerk/types";

export type ConfirmationSendActionResult =
  | { ok: true; sentCount: number; batchId: string; isDelta: boolean }
  | { ok: false; error: string };

export type ConfirmationSendCandidate = {
  employeeId: string;
  fullName: string;
  proposedCount: number;
};

export type ListConfirmationSendCandidatesResult =
  | { ok: true; candidates: ConfirmationSendCandidate[] }
  | { ok: false; error: string };

function revalidateConfirmationPaths(input: {
  organizationId: string;
  locationId?: string;
  weekStart: string;
}) {
  revalidatePath("/dashboard");
  revalidatePath("/planung");

  if (!input.locationId) return;

  for (const weekStart of weekStartsForShiftCacheInvalidation(input.weekStart)) {
    revalidateTag(
      dashboardShiftsCacheTag(input.organizationId, input.locationId, weekStart)
    );
  }
}

async function sendConfirmationForEmployee(input: {
  scope: ConfirmationRequestScope;
  weekStart: string;
  employeeId: string;
  shiftDate?: string;
  shiftId?: string;
  locationId?: string;
}): Promise<ConfirmationSendActionResult> {
  const { organizationId, userId, organization } = await requireManager();

  if (!organization.shift_confirmation_enabled) {
    return { ok: false, error: "Schichtbestätigung ist für diese Organisation nicht aktiv." };
  }

  const db = await getDatabase();
  const weekEnd = isoWeekEndFromWeekStart(input.weekStart);
  const proposed = await db.listProposedShiftsForConfirmationSend(organizationId, {
    weekStart: input.weekStart,
    weekEnd,
    locationId: input.locationId,
    employeeId: input.employeeId,
  });

  const scoped = filterShiftsForConfirmationSendScope(proposed, input.scope, {
    employeeId: input.employeeId,
    shiftDate: input.shiftDate,
    shiftId: input.shiftId,
  });

  const profile = await db.getProfileById(input.employeeId);
  if (!profile || profile.organization_id !== organizationId) {
    return { ok: false, error: "Mitarbeiter nicht gefunden." };
  }
  if (!profileEligibleForShiftConfirmationAssignment(profile)) {
    return {
      ok: false,
      error: "Mitarbeiter ohne App-Registrierung kann keine Anfrage erhalten.",
    };
  }

  const eligible = scoped.filter((shift) =>
    isShiftEligibleForConfirmationSend(shift, profile)
  );
  const latestSnapshots = await db.getLatestConfirmationSnapshotsByShiftIds(
    eligible.map((shift) => shift.id)
  );
  const sendable = filterSendableProposedShifts(eligible, latestSnapshots);

  if (!sendable.length) {
    return { ok: false, error: "Keine offenen Schichten zum Senden." };
  }

  const result = await db.sendConfirmationRequestForEmployee({
    organizationId,
    employeeId: input.employeeId,
    sentBy: userId,
    scope: input.scope,
    weekStart: input.weekStart,
    weekEnd,
    shifts: sendable,
    profile,
  });

  revalidateConfirmationPaths({
    organizationId,
    locationId: input.locationId,
    weekStart: input.weekStart,
  });

  return {
    ok: true,
    sentCount: result.sentCount,
    batchId: result.batchId,
    isDelta: result.isDelta,
  };
}

export async function sendConfirmationRequestForShift(input: {
  shiftId: string;
  weekStart: string;
  locationId?: string;
}): Promise<ConfirmationSendActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const shift = await db.getShiftRecordById(input.shiftId, organizationId);
    if (!shift) {
      return { ok: false, error: "Schicht nicht gefunden." };
    }

    return sendConfirmationForEmployee({
      scope: "single_shift",
      weekStart: input.weekStart,
      employeeId: shift.employee_id,
      shiftId: input.shiftId,
      locationId: input.locationId ?? shift.location_id ?? undefined,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Senden fehlgeschlagen.",
    };
  }
}

export async function sendConfirmationRequestForEmployeeDay(input: {
  employeeId: string;
  shiftDate: string;
  weekStart: string;
  locationId?: string;
}): Promise<ConfirmationSendActionResult> {
  try {
    return sendConfirmationForEmployee({
      scope: "employee_day",
      weekStart: input.weekStart,
      employeeId: input.employeeId,
      shiftDate: input.shiftDate,
      locationId: input.locationId,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Senden fehlgeschlagen.",
    };
  }
}

export async function sendConfirmationRequestForEmployeeWeek(input: {
  employeeId: string;
  weekStart: string;
  locationId?: string;
}): Promise<ConfirmationSendActionResult> {
  try {
    return sendConfirmationForEmployee({
      scope: "employee_week",
      weekStart: input.weekStart,
      employeeId: input.employeeId,
      locationId: input.locationId,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Senden fehlgeschlagen.",
    };
  }
}

export async function sendConfirmationRequestBulkWeek(input: {
  weekStart: string;
  employeeIds: string[];
  locationId?: string;
}): Promise<
  | {
      ok: true;
      results: Array<
        | { employeeId: string; ok: true; sentCount: number; batchId: string }
        | { employeeId: string; ok: false; error: string }
      >;
    }
  | { ok: false; error: string }
> {
  try {
    const { organizationId, organization } = await requireManager();
    if (!organization.shift_confirmation_enabled) {
      return { ok: false, error: "Schichtbestätigung ist für diese Organisation nicht aktiv." };
    }

    const uniqueEmployeeIds = [...new Set(input.employeeIds.filter(Boolean))];
    if (!uniqueEmployeeIds.length) {
      return { ok: false, error: "Keine Mitarbeiter ausgewählt." };
    }

    const results: Array<
      | { employeeId: string; ok: true; sentCount: number; batchId: string }
      | { employeeId: string; ok: false; error: string }
    > = [];

    for (const employeeId of uniqueEmployeeIds) {
      const result = await sendConfirmationForEmployee({
        scope: "bulk_week",
        weekStart: input.weekStart,
        employeeId,
        locationId: input.locationId,
      });
      if (result.ok) {
        results.push({
          employeeId,
          ok: true,
          sentCount: result.sentCount,
          batchId: result.batchId,
        });
      } else {
        results.push({ employeeId, ok: false, error: result.error });
      }
    }

    revalidateConfirmationPaths({
      organizationId,
      locationId: input.locationId,
      weekStart: input.weekStart,
    });

    return { ok: true, results };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Bulk-Senden fehlgeschlagen.",
    };
  }
}

export async function listConfirmationSendCandidates(input: {
  weekStart: string;
  locationId?: string;
}): Promise<ListConfirmationSendCandidatesResult> {
  try {
    const { organizationId, organization } = await requireManager();
    if (!organization.shift_confirmation_enabled) {
      return { ok: true, candidates: [] };
    }

    const db = await getDatabase();
    const weekEnd = isoWeekEndFromWeekStart(input.weekStart);
    const proposed = await db.listProposedShiftsForConfirmationSend(organizationId, {
      weekStart: input.weekStart,
      weekEnd,
      locationId: input.locationId,
    });

    if (!proposed.length) {
      return { ok: true, candidates: [] };
    }

    const profiles = await db.listOrganizationProfiles(organizationId);
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const latestSnapshots = await db.getLatestConfirmationSnapshotsByShiftIds(
      proposed.map((shift) => shift.id)
    );

    const counts = new Map<string, number>();
    for (const shift of proposed) {
      const profile = profileById.get(shift.employee_id);
      if (!profile || !profileEligibleForShiftConfirmationAssignment(profile)) {
        continue;
      }
      if (!isShiftEligibleForConfirmationSend(shift, profile)) continue;
      if (!filterSendableProposedShifts([shift], latestSnapshots).length) continue;
      counts.set(shift.employee_id, (counts.get(shift.employee_id) ?? 0) + 1);
    }

    const candidates = [...counts.entries()]
      .map(([employeeId, proposedCount]) => ({
        employeeId,
        fullName: profileById.get(employeeId)?.full_name ?? employeeId,
        proposedCount,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "de"));

    return { ok: true, candidates };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen.",
    };
  }
}
