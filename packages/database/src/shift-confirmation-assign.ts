import type { Profile, ShiftConfirmationStatus } from "@schichtwerk/types";
import {
  buildShiftConfirmationSnapshot,
  isShiftConfirmationSnapshotStale,
  shouldResetConfirmationToProposed,
  type ShiftConfirmationSnapshotSource,
} from "./shift-confirmation-snapshot";

export type ShiftConfirmationAssignPatch = {
  confirmation_status?: ShiftConfirmationStatus;
  confirmation_status_updated_at?: string;
  requested_at?: string | null;
  pending_since?: string | null;
  pending_reminder_sent_at?: string | null;
  employee_dismissed_at?: string | null;
};

export const SHIFT_CONFIRMATION_ASSIGN_GATE_ERROR =
  "Personal ohne App-Registrierung kann nicht eingeplant werden.";

export const SHIFT_ASSIGN_NOT_SCHEDULABLE_ERROR =
  "Personal ist nicht planbar.";

/** App registriert oder E-Mail-Fallback (Spec 008 §7.1). */
export function profileEligibleForShiftConfirmationAssignment(
  profile: Pick<Profile, "app_registered_at" | "email_fallback_mode">
): boolean {
  return profile.app_registered_at != null || profile.email_fallback_mode === true;
}

export function resolveInitialConfirmationStatus(
  shiftConfirmationEnabled: boolean
): ShiftConfirmationStatus {
  return shiftConfirmationEnabled ? "proposed" : "confirmed";
}

export function validateProfileForShiftConfirmationAssign(
  profile: Pick<
    Profile,
    "organization_id" | "is_active" | "schedulable" | "app_registered_at" | "email_fallback_mode"
  > | null,
  organizationId: string,
  shiftConfirmationEnabled: boolean,
  options?: { relaxAppRegistrationGate?: boolean }
): { ok: true } | { ok: false; error: string } {
  if (
    !profile ||
    profile.organization_id !== organizationId ||
    !profile.is_active
  ) {
    return { ok: false, error: "Personal nicht gefunden" };
  }

  if (!profile.schedulable) {
    return { ok: false, error: SHIFT_ASSIGN_NOT_SCHEDULABLE_ERROR };
  }

  if (
    shiftConfirmationEnabled &&
    !options?.relaxAppRegistrationGate &&
    !profileEligibleForShiftConfirmationAssignment(profile)
  ) {
    return { ok: false, error: SHIFT_CONFIRMATION_ASSIGN_GATE_ERROR };
  }

  return { ok: true };
}

export function resolveConfirmationAssignPatch(input: {
  shiftConfirmationEnabled: boolean;
  skipEmployeeConfirmationFlow?: boolean;
  existing: (ShiftConfirmationSnapshotSource & {
    confirmation_status?: ShiftConfirmationStatus;
  }) | null;
  next: ShiftConfirmationSnapshotSource;
}): ShiftConfirmationAssignPatch {
  const usesEmployeeConfirmationFlow =
    input.shiftConfirmationEnabled && !input.skipEmployeeConfirmationFlow;
  const now = new Date().toISOString();
  const clearedPending: ShiftConfirmationAssignPatch = {
    requested_at: null,
    pending_since: null,
    pending_reminder_sent_at: null,
  };

  const reactivateCanceledShift = (): ShiftConfirmationAssignPatch =>
    usesEmployeeConfirmationFlow
      ? {
          confirmation_status: "proposed",
          confirmation_status_updated_at: now,
          employee_dismissed_at: null,
          ...clearedPending,
        }
      : {
          confirmation_status: "confirmed",
          confirmation_status_updated_at: now,
          employee_dismissed_at: null,
          ...clearedPending,
        };

  if (!usesEmployeeConfirmationFlow) {
    if (!input.existing) {
      return {
        confirmation_status: "confirmed",
        confirmation_status_updated_at: now,
        ...clearedPending,
      };
    }
    if (input.existing.confirmation_status === "canceled") {
      return reactivateCanceledShift();
    }

    const currentStatus = input.existing.confirmation_status ?? "confirmed";
    const planChanged = isShiftConfirmationSnapshotStale(
      buildShiftConfirmationSnapshot(input.existing),
      input.next
    );
    if (
      planChanged &&
      shouldResetConfirmationToProposed(currentStatus)
    ) {
      return {
        confirmation_status: "confirmed",
        confirmation_status_updated_at: now,
        ...clearedPending,
      };
    }

    return {};
  }

  if (!input.existing) {
    return {
      confirmation_status: "proposed",
      confirmation_status_updated_at: now,
      ...clearedPending,
    };
  }

  const currentStatus = input.existing.confirmation_status ?? "confirmed";
  if (currentStatus === "canceled") {
    return reactivateCanceledShift();
  }

  const planChanged = isShiftConfirmationSnapshotStale(
    buildShiftConfirmationSnapshot(input.existing),
    input.next
  );

  if (!planChanged) {
    return {};
  }

  if (!shouldResetConfirmationToProposed(currentStatus)) {
    return {};
  }

  return {
    confirmation_status: "proposed",
    confirmation_status_updated_at: now,
    ...clearedPending,
  };
}
