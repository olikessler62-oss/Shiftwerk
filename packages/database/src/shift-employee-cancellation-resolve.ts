import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

import { Schema } from "./schema";
import { hasOpenEmployeeCancellationRequest } from "./shift-request-writes";

const T = Schema.tables;

export type EmployeeCancellationResolutionSource =
  | "manager_resolve_delete"
  | "manager_resolve_reassign";

export function buildEmployeeShiftRemovedAfterOwnCancellationNotification(input: {
  shiftId: string;
  shiftDate: string;
  startsAt: string;
  endsAt: string;
}): {
  templateKey: "shift_removed_after_employee_cancellation";
  title: string;
  body: string;
  payload: Record<string, unknown>;
} {
  const timeLabel = `${formatDeTime(input.startsAt)}–${formatDeTime(input.endsAt)}`;
  const dateLabel = formatDeDate(input.shiftDate);

  return {
    templateKey: "shift_removed_after_employee_cancellation",
    title: "Schicht entfernt",
    body: `Deine Schicht am ${dateLabel} (${timeLabel}) wurde aus deinem Plan entfernt.`,
    payload: {
      shift_id: input.shiftId,
      shift_date: input.shiftDate,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      resolved_after: "employee_cancellation",
    },
  };
}

function formatDeDate(isoDate: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}

function formatDeTime(isoDateTime: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDateTime));
}

export async function approveOpenEmployeeCancellationRequest(input: {
  client: SupabaseClient;
  organizationId: string;
  shiftId: string;
  actorId: string;
  fromConfirmationStatus: ShiftConfirmationStatus;
  source: EmployeeCancellationResolutionSource;
}): Promise<{ requestId: string; employeeId: string } | null> {
  const { data: openRequest, error: requestError } = await input.client
    .from(T.shiftRequests)
    .select("id, actor_id, payload")
    .eq("organization_id", input.organizationId)
    .eq("shift_id", input.shiftId)
    .eq("type", "cancellation")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (requestError) throw new Error(requestError.message);
  if (!openRequest) return null;

  const payload = openRequest.payload as { cancelled_by?: string } | null;
  if (payload?.cancelled_by !== "employee") {
    return null;
  }

  const now = new Date().toISOString();
  const { data: approvedRequest, error: approveRequestError } = await input.client
    .from(T.shiftRequests)
    .update({
      status: "approved",
      responded_at: now,
      updated_at: now,
    })
    .eq("id", openRequest.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (approveRequestError) throw new Error(approveRequestError.message);
  if (!approvedRequest) {
    throw new Error("Absage-Anfrage konnte nicht abgeschlossen werden.");
  }

  const { error: eventError } = await input.client.from(T.shiftConfirmationEvents).insert({
    organization_id: input.organizationId,
    shift_id: input.shiftId,
    actor_id: input.actorId,
    from_status: input.fromConfirmationStatus,
    to_status: input.fromConfirmationStatus,
    payload: {
      canceled_by: "employee",
      source: input.source,
      cancellation_request_id: openRequest.id,
    },
  });
  if (eventError) throw new Error(eventError.message);

  return {
    requestId: openRequest.id as string,
    employeeId: openRequest.actor_id as string,
  };
}

export async function shiftHasOpenEmployeeCancellationRequest(input: {
  client: SupabaseClient;
  organizationId: string;
  shiftId: string;
}): Promise<boolean> {
  return hasOpenEmployeeCancellationRequest(input);
}
