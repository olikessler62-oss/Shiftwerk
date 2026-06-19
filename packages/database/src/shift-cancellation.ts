import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import { resolveEffectiveConfirmationStatus } from "./shift-confirmation-pending";

export const SHIFT_CANCELLABLE_CONFIRMATION_STATUSES = [
  "requested",
  "pending",
  "confirmed",
] as const satisfies readonly ShiftConfirmationStatus[];

export type ShiftCancellableConfirmationStatus =
  (typeof SHIFT_CANCELLABLE_CONFIRMATION_STATUSES)[number];

export const SHIFT_CANCEL_PAST_ERROR =
  "Vergangene Schichten können nicht abgesagt werden.";

export const SHIFT_CANCEL_BLOCKED_ERROR_PREFIX = "SHIFT_CANCEL_BLOCKED:";

export const SHIFT_CANCEL_NOT_OWNER_ERROR =
  "Schicht gehört nicht zum Mitarbeiter.";

export function isShiftDateInPast(
  shiftDateISO: string,
  now: Date = new Date()
): boolean {
  const [y, m, d] = shiftDateISO.split("-").map(Number);
  const shiftDate = new Date(y, m - 1, d);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return shiftDate < today;
}

export function isShiftCancellableConfirmationStatus(
  status: ShiftConfirmationStatus | undefined | null
): status is ShiftCancellableConfirmationStatus {
  return (
    status === "requested" ||
    status === "pending" ||
    status === "confirmed"
  );
}

export function resolveEffectiveShiftConfirmationStatus(
  confirmationStatus: ShiftConfirmationStatus | undefined | null,
  requestedAt: string | null | undefined,
  now: Date = new Date()
): ShiftConfirmationStatus | undefined {
  if (!confirmationStatus) return undefined;
  return (
    resolveEffectiveConfirmationStatus(confirmationStatus, requestedAt, now) ??
    confirmationStatus
  );
}

export function canCancelShiftByConfirmationStatus(
  confirmationStatus: ShiftConfirmationStatus | undefined | null,
  requestedAt?: string | null,
  now: Date = new Date()
): boolean {
  const effective = resolveEffectiveShiftConfirmationStatus(
    confirmationStatus,
    requestedAt,
    now
  );
  return isShiftCancellableConfirmationStatus(effective);
}

export function shiftCancelBlockedActionError(
  status: ShiftConfirmationStatus
): string {
  return `${SHIFT_CANCEL_BLOCKED_ERROR_PREFIX}${status}`;
}

export function parseShiftCancelBlockedStatus(
  message: string
): ShiftConfirmationStatus | null {
  if (!message.startsWith(SHIFT_CANCEL_BLOCKED_ERROR_PREFIX)) return null;
  const status = message.slice(SHIFT_CANCEL_BLOCKED_ERROR_PREFIX.length);
  if (
    status === "proposed" ||
    status === "requested" ||
    status === "confirmed" ||
    status === "rejected" ||
    status === "pending" ||
    status === "canceled"
  ) {
    return status;
  }
  return null;
}

export function buildManagerShiftCanceledNotification(input: {
  employeeName: string;
  canceledBy: "employee" | "manager";
  shiftDate: string;
  shiftId: string;
  employeeId: string;
}): {
  type: "employee_shift_canceled";
  title: string;
  body: string;
  payload: Record<string, unknown>;
} {
  const title =
    input.canceledBy === "employee"
      ? `Schicht abgesagt: ${input.employeeName}`
      : `Schicht storniert: ${input.employeeName}`;
  const body =
    input.canceledBy === "employee"
      ? `${input.employeeName} hat eine geplante Schicht abgesagt.`
      : `Eine Schicht für ${input.employeeName} wurde storniert.`;

  return {
    type: "employee_shift_canceled",
    title,
    body,
    payload: {
      shift_id: input.shiftId,
      employee_id: input.employeeId,
      employee_name: input.employeeName,
      shift_date: input.shiftDate,
      canceled_by: input.canceledBy,
    },
  };
}
