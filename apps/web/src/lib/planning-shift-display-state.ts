import type { ShiftCardDisplayState, ShiftConfirmationStatus } from "@schichtwerk/types";
import { resolveCalendarShiftConfirmationStatus } from "@schichtwerk/database";

import {
  resolveShiftCardDisplayState,
  type ShiftRequestSummary,
} from "@/lib/shift-display-state";

export type PlanningShiftConfirmationSource = {
  shiftId: string;
  shiftDate?: string;
  lifecycle?: ShiftCardDisplayState["lifecycle"] | null;
  confirmationStatus?: ShiftConfirmationStatus | null;
  requestedAt?: string | null;
  confirmationStatusUpdatedAt?: string | null;
  requests?: readonly ShiftRequestSummary[];
};

export type PlanningShiftConfirmationFields = {
  displayState: ShiftCardDisplayState;
  confirmationStatus: ShiftConfirmationStatus;
  requestedAt: string | null;
  confirmationStatusUpdatedAt: string | null;
};

export function resolvePlanningShiftConfirmationFields(
  source: PlanningShiftConfirmationSource
): PlanningShiftConfirmationFields {
  const displayState = resolveShiftCardDisplayState({
    shiftId: source.shiftId,
    lifecycle: source.lifecycle,
    confirmationStatus: source.confirmationStatus,
    requestedAt: source.requestedAt,
    requests: source.requests,
  });

  let confirmationStatus = displayState.legacyConfirmationStatus;
  if (source.shiftDate) {
    confirmationStatus =
      resolveCalendarShiftConfirmationStatus({
        status: confirmationStatus,
        requestedAt: source.requestedAt,
        shiftDateISO: source.shiftDate,
      }) ?? confirmationStatus;
  }

  return {
    displayState: {
      ...displayState,
      legacyConfirmationStatus: confirmationStatus,
    },
    confirmationStatus,
    requestedAt: source.requestedAt ?? null,
    confirmationStatusUpdatedAt: source.confirmationStatusUpdatedAt ?? null,
  };
}

export function resolveShiftCancelActorFromDisplayState(
  displayState: ShiftCardDisplayState | undefined
): "employee" | "manager" | undefined {
  return displayState?.openCancellation?.cancelledBy;
}
