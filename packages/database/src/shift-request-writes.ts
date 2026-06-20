import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ShiftConfirmationStatus,
  ShiftLifecycleStatus,
  ShiftRequestActorRole,
} from "@schichtwerk/types";

import { Schema } from "./schema";
import { resolveShiftLifecycleFromLegacy } from "./shift-display-state";

const T = Schema.tables;

const OPEN_CONFIRMATION_STATUSES = ["pending", "expired"] as const;
const RESEND_CLOSE_CONFIRMATION_STATUSES = [
  "pending",
  "expired",
  "rejected",
] as const;

export function lifecycleStatusForConfirmationStatus(
  confirmationStatus: ShiftConfirmationStatus | undefined | null
): ShiftLifecycleStatus {
  if (!confirmationStatus) return "confirmed";
  return resolveShiftLifecycleFromLegacy(confirmationStatus);
}

export function enrichShiftRowWithLifecycle<
  T extends {
    confirmation_status?: ShiftConfirmationStatus;
    lifecycle_status?: ShiftLifecycleStatus;
  },
>(row: T): T {
  if (row.lifecycle_status || !row.confirmation_status) return row;
  return {
    ...row,
    lifecycle_status: lifecycleStatusForConfirmationStatus(row.confirmation_status),
  };
}

async function cancelShiftConfirmationRequests(
  client: SupabaseClient,
  organizationId: string,
  shiftId: string,
  now: string,
  statuses: readonly string[]
): Promise<void> {
  if (!statuses.length) return;

  const { error } = await client
    .from(T.shiftRequests)
    .update({ status: "cancelled", updated_at: now })
    .eq("organization_id", organizationId)
    .eq("shift_id", shiftId)
    .eq("type", "confirmation")
    .in("status", [...statuses]);

  if (error) throw new Error(error.message);
}

async function insertShiftRequest(
  client: SupabaseClient,
  row: {
    organization_id: string;
    shift_id: string;
    type: "confirmation" | "cancellation";
    status: "pending" | "approved" | "rejected" | "expired" | "cancelled";
    actor_id?: string | null;
    sent_at?: string | null;
    responded_at?: string | null;
    expires_at?: string | null;
    reminder_sent_at?: string | null;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await client.from(T.shiftRequests).insert({
    ...row,
    payload: row.payload ?? {},
  });
  if (error) throw new Error(error.message);
}

async function updateOpenConfirmationRequest(
  client: SupabaseClient,
  organizationId: string,
  shiftId: string,
  patch: {
    status: "approved" | "rejected" | "expired" | "cancelled";
    responded_at?: string | null;
    reminder_sent_at?: string | null;
  },
  now: string
): Promise<boolean> {
  const { data, error } = await client
    .from(T.shiftRequests)
    .update({ ...patch, updated_at: now })
    .eq("organization_id", organizationId)
    .eq("shift_id", shiftId)
    .eq("type", "confirmation")
    .in("status", [...OPEN_CONFIRMATION_STATUSES])
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function syncShiftRequestsAfterConfirmationSent(input: {
  client: SupabaseClient;
  organizationId: string;
  shiftId: string;
  actorId: string;
  sentAt: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await cancelShiftConfirmationRequests(
    input.client,
    input.organizationId,
    input.shiftId,
    input.sentAt,
    RESEND_CLOSE_CONFIRMATION_STATUSES
  );

  await insertShiftRequest(input.client, {
    organization_id: input.organizationId,
    shift_id: input.shiftId,
    type: "confirmation",
    status: "pending",
    actor_id: input.actorId,
    sent_at: input.sentAt,
    payload: input.payload,
  });
}

// Intentional thin wrapper: "resent" and "sent" currently share the same sync
// logic, but keeping them separate preserves the semantic boundary so diverging
// behaviour (e.g. different audit trail) can be added here without a breaking change.
export async function syncShiftRequestsAfterConfirmationResent(input: {
  client: SupabaseClient;
  organizationId: string;
  shiftId: string;
  actorId: string;
  sentAt: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await syncShiftRequestsAfterConfirmationSent(input);
}

export async function syncShiftRequestsAfterConfirmationExpired(input: {
  client: SupabaseClient;
  organizationId: string;
  shiftId: string;
  now: string;
}): Promise<void> {
  const updated = await updateOpenConfirmationRequest(
    input.client,
    input.organizationId,
    input.shiftId,
    {
      status: "expired",
      reminder_sent_at: input.now,
    },
    input.now
  );

  if (!updated) {
    await insertShiftRequest(input.client, {
      organization_id: input.organizationId,
      shift_id: input.shiftId,
      type: "confirmation",
      status: "expired",
      sent_at: input.now,
      reminder_sent_at: input.now,
      payload: { source: "pending_job_backfill" },
    });
  }
}

export async function syncShiftRequestsAfterEmployeeResponse(input: {
  client: SupabaseClient;
  organizationId: string;
  shiftId: string;
  employeeId: string;
  decision: "confirm" | "reject";
  now: string;
}): Promise<void> {
  const requestStatus = input.decision === "confirm" ? "approved" : "rejected";
  const updated = await updateOpenConfirmationRequest(
    input.client,
    input.organizationId,
    input.shiftId,
    {
      status: requestStatus,
      responded_at: input.now,
    },
    input.now
  );

  if (!updated) {
    await insertShiftRequest(input.client, {
      organization_id: input.organizationId,
      shift_id: input.shiftId,
      type: "confirmation",
      status: requestStatus,
      actor_id: input.employeeId,
      responded_at: input.now,
      payload: { source: "mobile_respond_backfill" },
    });
  }
}

export async function syncShiftRequestsAfterCancellation(input: {
  client: SupabaseClient;
  organizationId: string;
  shiftId: string;
  actorId: string;
  cancelledBy: ShiftRequestActorRole;
  now: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await cancelShiftConfirmationRequests(
    input.client,
    input.organizationId,
    input.shiftId,
    input.now,
    OPEN_CONFIRMATION_STATUSES
  );

  await insertShiftRequest(input.client, {
    organization_id: input.organizationId,
    shift_id: input.shiftId,
    type: "cancellation",
    status: "approved",
    actor_id: input.actorId,
    sent_at: input.now,
    responded_at: input.now,
    payload: {
      cancelled_by: input.cancelledBy,
      ...(input.payload ?? {}),
    },
  });
}

export async function syncShiftRequestsAfterManagerPastConfirm(input: {
  client: SupabaseClient;
  organizationId: string;
  shiftId: string;
  actorId: string;
  now: string;
}): Promise<void> {
  await cancelShiftConfirmationRequests(
    input.client,
    input.organizationId,
    input.shiftId,
    input.now,
    OPEN_CONFIRMATION_STATUSES
  );

  await insertShiftRequest(input.client, {
    organization_id: input.organizationId,
    shift_id: input.shiftId,
    type: "confirmation",
    status: "approved",
    actor_id: input.actorId,
    responded_at: input.now,
    payload: { source: "manager_past_confirm" },
  });
}

export async function syncShiftRequestsAfterAssignConfirmationStatus(input: {
  client: SupabaseClient;
  organizationId: string;
  shiftId: string;
  confirmationStatus: ShiftConfirmationStatus;
  now: string;
}): Promise<void> {
  if (input.confirmationStatus === "proposed") {
    await cancelShiftConfirmationRequests(
      input.client,
      input.organizationId,
      input.shiftId,
      input.now,
      RESEND_CLOSE_CONFIRMATION_STATUSES
    );
    return;
  }

  if (input.confirmationStatus === "confirmed") {
    await cancelShiftConfirmationRequests(
      input.client,
      input.organizationId,
      input.shiftId,
      input.now,
      OPEN_CONFIRMATION_STATUSES
    );
  }
}

export async function syncShiftRequestsForSuperadminStatus(input: {
  client: SupabaseClient;
  organizationId: string;
  shiftId: string;
  actorId: string;
  toStatus: ShiftConfirmationStatus;
  now: string;
}): Promise<void> {
  switch (input.toStatus) {
    case "proposed":
      await cancelShiftConfirmationRequests(
        input.client,
        input.organizationId,
        input.shiftId,
        input.now,
        RESEND_CLOSE_CONFIRMATION_STATUSES
      );
      return;
    case "requested":
      await syncShiftRequestsAfterConfirmationSent({
        client: input.client,
        organizationId: input.organizationId,
        shiftId: input.shiftId,
        actorId: input.actorId,
        sentAt: input.now,
        payload: { source: "superadmin_simulation" },
      });
      return;
    case "pending":
      await cancelShiftConfirmationRequests(
        input.client,
        input.organizationId,
        input.shiftId,
        input.now,
        RESEND_CLOSE_CONFIRMATION_STATUSES
      );
      await insertShiftRequest(input.client, {
        organization_id: input.organizationId,
        shift_id: input.shiftId,
        type: "confirmation",
        status: "expired",
        actor_id: input.actorId,
        sent_at: input.now,
        reminder_sent_at: input.now,
        payload: { source: "superadmin_simulation" },
      });
      return;
    case "confirmed":
      await syncShiftRequestsAfterManagerPastConfirm({
        client: input.client,
        organizationId: input.organizationId,
        shiftId: input.shiftId,
        actorId: input.actorId,
        now: input.now,
      });
      return;
    case "rejected":
      await cancelShiftConfirmationRequests(
        input.client,
        input.organizationId,
        input.shiftId,
        input.now,
        RESEND_CLOSE_CONFIRMATION_STATUSES
      );
      await insertShiftRequest(input.client, {
        organization_id: input.organizationId,
        shift_id: input.shiftId,
        type: "confirmation",
        status: "rejected",
        actor_id: input.actorId,
        responded_at: input.now,
        payload: { source: "superadmin_simulation" },
      });
      return;
    case "canceled":
      await syncShiftRequestsAfterCancellation({
        client: input.client,
        organizationId: input.organizationId,
        shiftId: input.shiftId,
        actorId: input.actorId,
        cancelledBy: "manager",
        now: input.now,
        payload: { source: "superadmin_simulation" },
      });
      return;
  }
}
