import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import type { OrganizationTimeZoneInput } from "./organization-timezone";
import {
  isShiftConfirmationPendingDue,
  PENDING_ELAPSED_MINUTES_REQUIRED,
} from "./business-minutes";
import { resolveOrganizationShiftConfirmationPendingAfterMinutes } from "./organization-shift-confirmation-settings";

export type RequestedShiftForPendingJob = {
  id: string;
  organization_id: string;
  employee_id: string;
  shift_date: string;
  requested_at: string;
  employee_full_name: string;
  email_fallback_mode: boolean;
  organization: OrganizationTimeZoneInput;
};

export type ShiftConfirmationPendingJobResult = {
  scanned: number;
  transitioned: number;
  errors: { shiftId: string; error: string }[];
};

export function isRequestedShiftDueForPendingTransition(
  shift: Pick<RequestedShiftForPendingJob, "requested_at" | "organization">,
  now: Date
): boolean {
  const pendingAfterMinutes = resolveOrganizationShiftConfirmationPendingAfterMinutes(
    shift.organization
  );
  return isShiftConfirmationPendingDue(
    shift.requested_at,
    now,
    pendingAfterMinutes
  );
}

export function filterRequestedShiftsDueForPendingTransition(
  shifts: readonly RequestedShiftForPendingJob[],
  now: Date
): RequestedShiftForPendingJob[] {
  return shifts.filter((shift) => isRequestedShiftDueForPendingTransition(shift, now));
}

/** UI/Anzeige: requested mit abgelaufener Frist wie pending behandeln. */
export function resolveEffectiveConfirmationStatus(
  status: ShiftConfirmationStatus | null | undefined,
  requestedAt: string | null | undefined,
  now: Date = new Date(),
  pendingAfterMinutes: number = PENDING_ELAPSED_MINUTES_REQUIRED
): ShiftConfirmationStatus | undefined {
  if (!status) return undefined;
  if (
    status === "requested" &&
    requestedAt &&
    isShiftConfirmationPendingDue(requestedAt, now, pendingAfterMinutes)
  ) {
    return "pending";
  }
  return status;
}

export function buildPendingReminderNotificationTitle(): string {
  return "Erinnerung: Schichtbestätigung ausstehend";
}

export function buildPendingReminderNotificationBody(shiftDate: string): string {
  return `Bitte bestätigen Sie Ihre Schicht am ${shiftDate}.`;
}

export function buildManagerPendingEscalationTitle(employeeName: string): string {
  return `Ausstehende Schichtbestätigung: ${employeeName}`;
}

export function buildManagerPendingEscalationBody(employeeName: string): string {
  return `${employeeName} hat auf Schichten nicht rechtzeitig geantwortet.`;
}

export { PENDING_ELAPSED_MINUTES_REQUIRED, PENDING_ELAPSED_MINUTES_REQUIRED as PENDING_BUSINESS_MINUTES_REQUIRED };
