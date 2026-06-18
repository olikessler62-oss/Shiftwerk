"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  dashboardShiftsCacheTag,
  weekStartsForShiftCacheInvalidation,
} from "@/lib/cached-dashboard-shifts";
import { getDatabase } from "@/lib/db";
import { runShiftConfirmationPendingJobSafe } from "@/lib/run-shift-confirmation-pending-job";
import { shiftTimeFromTimestamp } from "@/lib/dates";
import { requireManager } from "@/lib/manager";
import { resolveSimulatedProposedAssignOptions } from "@/lib/shift-confirmation-assign-mode";
import {
  filterSendableProposedShifts,
  filterShiftsForConfirmationSendScope,
  isoWeekEndFromWeekStart,
  isShiftEligibleForConfirmationSend,
  isShiftProposedForSend,
  profileEligibleForShiftConfirmationAssignment,
  resolveOrganizationTimeZone,
} from "@schichtwerk/database";
import type { ConfirmationRequestScope, ShiftConfirmationStatus } from "@schichtwerk/types";

export type ConfirmationSendActionResult =
  | { ok: true; sentCount: number; batchId: string; isDelta: boolean }
  | { ok: false; error: string };

export type ConfirmationSendShiftRow = {
  shiftId: string;
  employeeId: string;
  employeeName: string;
  shiftDate: string;
  templateName: string | null;
  startTime: string;
  endTime: string;
  confirmationStatus: ShiftConfirmationStatus;
  sendable: boolean;
};

export type ListConfirmationSendShiftsResult =
  | { ok: true; shifts: ConfirmationSendShiftRow[] }
  | { ok: false; error: string };

function revalidateConfirmationPaths(input: {
  organizationId: string;
  locationId?: string;
  weekStart: string;
}) {
  revalidatePath("/planer");
  revalidatePath("/dashboard");

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
  simulatedProposedOnAssign?: boolean;
}): Promise<ConfirmationSendActionResult> {
  const { organizationId, userId, organization, profile: managerProfile } =
    await requireManager();
  const assignMode = resolveSimulatedProposedAssignOptions({
    organizationEnabled: organization.shift_confirmation_enabled,
    simulatedProposedOnAssign: input.simulatedProposedOnAssign,
    managerEmail: managerProfile.email,
  });

  if (!assignMode.shiftConfirmationEnabled) {
    return {
      ok: false,
      error: "Schichtbestätigung ist für diese Organisation nicht aktiv.",
    };
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

  if (!assignMode.relaxAppRegistrationGate) {
    if (!profileEligibleForShiftConfirmationAssignment(profile)) {
      return {
        ok: false,
        error: "Mitarbeiter ohne App-Registrierung kann keine Anfrage erhalten.",
      };
    }
  }

  const eligible = assignMode.relaxAppRegistrationGate
    ? scoped.filter(
        (shift) =>
          shift.employee_id === profile.id && isShiftProposedForSend(shift)
      )
    : scoped.filter((shift) => isShiftEligibleForConfirmationSend(shift, profile));

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
    skipNotificationOutbox: assignMode.relaxAppRegistrationGate,
  });

  revalidateConfirmationPaths({
    organizationId,
    locationId: input.locationId,
    weekStart: input.weekStart,
  });

  await runShiftConfirmationPendingJobSafe(db);

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
  simulatedProposedOnAssign?: boolean;
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
      simulatedProposedOnAssign: input.simulatedProposedOnAssign,
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
  simulatedProposedOnAssign?: boolean;
}): Promise<ConfirmationSendActionResult> {
  try {
    return sendConfirmationForEmployee({
      scope: "employee_day",
      weekStart: input.weekStart,
      employeeId: input.employeeId,
      shiftDate: input.shiftDate,
      locationId: input.locationId,
      simulatedProposedOnAssign: input.simulatedProposedOnAssign,
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
  simulatedProposedOnAssign?: boolean;
}): Promise<ConfirmationSendActionResult> {
  try {
    return sendConfirmationForEmployee({
      scope: "employee_week",
      weekStart: input.weekStart,
      employeeId: input.employeeId,
      locationId: input.locationId,
      simulatedProposedOnAssign: input.simulatedProposedOnAssign,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Senden fehlgeschlagen.",
    };
  }
}

export async function sendConfirmationRequestForSelectedShifts(input: {
  shiftIds: string[];
  weekStart: string;
  locationId?: string;
  simulatedProposedOnAssign?: boolean;
}): Promise<
  | {
      ok: true;
      results: Array<
        | { shiftId: string; ok: true; sentCount: number; batchId: string }
        | { shiftId: string; ok: false; error: string }
      >;
    }
  | { ok: false; error: string }
> {
  try {
    const uniqueShiftIds = [...new Set(input.shiftIds.filter(Boolean))];
    if (!uniqueShiftIds.length) {
      return { ok: false, error: "Keine Schichten ausgewählt." };
    }

    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const results: Array<
      | { shiftId: string; ok: true; sentCount: number; batchId: string }
      | { shiftId: string; ok: false; error: string }
    > = [];

    for (const shiftId of uniqueShiftIds) {
      const shift = await db.getShiftRecordById(shiftId, organizationId);
      if (!shift) {
        results.push({ shiftId, ok: false, error: "Schicht nicht gefunden." });
        continue;
      }

      const result = await sendConfirmationForEmployee({
        scope: "single_shift",
        weekStart: input.weekStart,
        employeeId: shift.employee_id,
        shiftId,
        locationId: input.locationId,
        simulatedProposedOnAssign: input.simulatedProposedOnAssign,
      });
      if (result.ok) {
        results.push({
          shiftId,
          ok: true,
          sentCount: result.sentCount,
          batchId: result.batchId,
        });
      } else {
        results.push({ shiftId, ok: false, error: result.error });
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
      error: e instanceof Error ? e.message : "Senden fehlgeschlagen.",
    };
  }
}

export async function sendConfirmationRequestBulkWeek(input: {
  weekStart: string;
  employeeIds: string[];
  locationId?: string;
  simulatedProposedOnAssign?: boolean;
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
    const { organizationId } = await requireManager();

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
        simulatedProposedOnAssign: input.simulatedProposedOnAssign,
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

export async function listConfirmationSendShifts(input: {
  weekStart: string;
  locationId?: string;
  simulatedProposedOnAssign?: boolean;
}): Promise<ListConfirmationSendShiftsResult> {
  try {
    const { organizationId, organization, profile } = await requireManager();
    const assignMode = resolveSimulatedProposedAssignOptions({
      organizationEnabled: organization.shift_confirmation_enabled,
      simulatedProposedOnAssign: input.simulatedProposedOnAssign,
      managerEmail: profile.email,
    });
    if (!assignMode.shiftConfirmationEnabled) {
      return { ok: true, shifts: [] };
    }

    const db = await getDatabase();
    const timeZone = resolveOrganizationTimeZone(organization);
    const weekEnd = isoWeekEndFromWeekStart(input.weekStart);
    const rows = await db.listShiftsForConfirmationSendModal(organizationId, {
      weekStart: input.weekStart,
      weekEnd,
      locationId: input.locationId,
    });

    if (!rows.length) {
      return { ok: true, shifts: [] };
    }

    const profiles = await db.listOrganizationProfiles(organizationId);
    const profileById = new Map(profiles.map((entry) => [entry.id, entry]));
    const proposedRows = rows.filter((row) => row.confirmation_status === "proposed");
    const latestSnapshots = await db.getLatestConfirmationSnapshotsByShiftIds(
      proposedRows.map((row) => row.id)
    );

    const shifts: ConfirmationSendShiftRow[] = [];

    for (const row of rows) {
      const employeeProfile = profileById.get(row.employee_id);
      if (!employeeProfile) continue;

      const status = row.confirmation_status ?? "confirmed";
      let sendable = false;

      if (status === "proposed") {
        if (assignMode.relaxAppRegistrationGate) {
          sendable = isShiftProposedForSend(row);
        } else if (
          profileEligibleForShiftConfirmationAssignment(employeeProfile) &&
          isShiftEligibleForConfirmationSend(row, employeeProfile)
        ) {
          sendable = filterSendableProposedShifts([row], latestSnapshots).length > 0;
        }
      }

      shifts.push({
        shiftId: row.id,
        employeeId: row.employee_id,
        employeeName: row.employee_full_name || employeeProfile.full_name,
        shiftDate: row.shift_date,
        templateName: row.template_name,
        startTime: shiftTimeFromTimestamp(row.starts_at, timeZone),
        endTime: shiftTimeFromTimestamp(row.ends_at, timeZone),
        confirmationStatus: status,
        sendable,
      });
    }

    shifts.sort((a, b) => {
      const dateDiff = a.shiftDate.localeCompare(b.shiftDate);
      if (dateDiff !== 0) return dateDiff;
      const timeDiff = a.startTime.localeCompare(b.startTime);
      if (timeDiff !== 0) return timeDiff;
      return a.employeeName.localeCompare(b.employeeName, "de");
    });

    return { ok: true, shifts };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen.",
    };
  }
}

export async function resendConfirmationRequestForSelectedShifts(input: {
  shiftIds: string[];
  weekStart: string;
  locationId?: string;
}): Promise<
  | { ok: true; sentCount: number; failed: Array<{ shiftId: string; error: string }> }
  | { ok: false; error: string }
> {
  try {
    const uniqueShiftIds = [...new Set(input.shiftIds.filter(Boolean))];
    if (!uniqueShiftIds.length) {
      return { ok: false, error: "Keine Schichten ausgewählt." };
    }

    const { organizationId, userId } = await requireManager();
    const db = await getDatabase();
    const result = await db.resendConfirmationRequestsForShifts({
      organizationId,
      sentBy: userId,
      shiftIds: uniqueShiftIds,
    });

    revalidateConfirmationPaths({
      organizationId,
      locationId: input.locationId,
      weekStart: input.weekStart,
    });

    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erneut anfordern fehlgeschlagen.",
    };
  }
}

export async function submitCommunicationConfirmationRequests(input: {
  shiftIds: string[];
  weekStart: string;
  locationId?: string;
  simulatedProposedOnAssign?: boolean;
}): Promise<
  | {
      ok: true;
      sentCount: number;
      failedCount: number;
      errors: string[];
    }
  | { ok: false; error: string }
> {
  try {
    const uniqueShiftIds = [...new Set(input.shiftIds.filter(Boolean))];
    if (!uniqueShiftIds.length) {
      return { ok: false, error: "Keine Schichten ausgewählt." };
    }

    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const proposedIds: string[] = [];
    const resendIds: string[] = [];

    for (const shiftId of uniqueShiftIds) {
      const shift = await db.getShiftRecordById(shiftId, organizationId);
      if (!shift?.confirmation_status) continue;
      if (shift.confirmation_status === "proposed") {
        proposedIds.push(shiftId);
      } else if (
        shift.confirmation_status === "requested" ||
        shift.confirmation_status === "pending" ||
        shift.confirmation_status === "rejected"
      ) {
        resendIds.push(shiftId);
      }
    }

    let sentCount = 0;
    const errors: string[] = [];

    if (proposedIds.length > 0) {
      const sendResult = await sendConfirmationRequestForSelectedShifts({
        shiftIds: proposedIds,
        weekStart: input.weekStart,
        locationId: input.locationId,
        simulatedProposedOnAssign: input.simulatedProposedOnAssign,
      });
      if (!sendResult.ok) {
        errors.push(sendResult.error);
      } else {
        sentCount += sendResult.results.filter((row) => row.ok).length;
        for (const row of sendResult.results) {
          if (!row.ok) errors.push(row.error);
        }
      }
    }

    if (resendIds.length > 0) {
      const resendResult = await resendConfirmationRequestForSelectedShifts({
        shiftIds: resendIds,
        weekStart: input.weekStart,
        locationId: input.locationId,
      });
      if (!resendResult.ok) {
        errors.push(resendResult.error);
      } else {
        sentCount += resendResult.sentCount;
        for (const row of resendResult.failed) {
          errors.push(row.error);
        }
      }
    }

    if (sentCount === 0 && errors.length > 0) {
      return { ok: false, error: errors[0] ?? "Senden fehlgeschlagen." };
    }

    return {
      ok: true,
      sentCount,
      failedCount: errors.length,
      errors,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Senden fehlgeschlagen.",
    };
  }
}
