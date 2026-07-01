import type {
  ShiftCardDisplayState,
  ShiftConfirmationStatus,
  ShiftLifecycleStatus,
  ShiftRequest,
  ShiftRequestActorRole,
  ShiftRequestStatus,
} from "@schichtwerk/types";

import { isShiftConfirmationPendingDue } from "./business-minutes";
import { DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES } from "./organization-shift-confirmation-settings";

export type ShiftRequestSummary = Pick<
  ShiftRequest,
  | "id"
  | "shift_id"
  | "type"
  | "status"
  | "sent_at"
  | "responded_at"
  | "payload"
  | "created_at"
>;

export type ShiftDisplayInput = {
  shiftId: string;
  lifecycle?: ShiftLifecycleStatus | null;
  /** Legacy-Felder — Fallback solange lifecycle/requests noch nicht geladen sind. */
  confirmationStatus?: ShiftConfirmationStatus | null;
  requestedAt?: string | null;
  requests?: readonly ShiftRequestSummary[];
  pendingAfterMinutes?: number;
};

const OPEN_CONFIRMATION_STATUSES = new Set<ShiftRequestStatus>([
  "pending",
  "expired",
]);

export function resolveShiftLifecycleFromLegacy(
  confirmationStatus: ShiftConfirmationStatus | null | undefined
): ShiftLifecycleStatus {
  if (confirmationStatus === "confirmed") return "confirmed";
  if (confirmationStatus === "canceled") return "cancelled";
  if (confirmationStatus === "unresolved") return "planned";
  return "planned";
}

export function resolveLifecycleFromInput(input: ShiftDisplayInput): ShiftLifecycleStatus {
  const fromConfirmation = resolveShiftLifecycleFromLegacy(input.confirmationStatus);

  if (input.lifecycle === "confirmed" || input.lifecycle === "cancelled") {
    return input.lifecycle;
  }

  if (fromConfirmation === "confirmed" || fromConfirmation === "cancelled") {
    return fromConfirmation;
  }

  if (input.lifecycle) return input.lifecycle;
  return fromConfirmation;
}

function sortRequestsNewestFirst(
  requests: readonly ShiftRequestSummary[]
): ShiftRequestSummary[] {
  return [...requests].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function latestConfirmationRequest(
  requests: readonly ShiftRequestSummary[] | undefined
): ShiftRequestSummary | undefined {
  if (!requests?.length) return undefined;
  return sortRequestsNewestFirst(
    requests.filter((request) => request.type === "confirmation")
  )[0];
}

function latestCancellationRequest(
  requests: readonly ShiftRequestSummary[] | undefined
): ShiftRequestSummary | undefined {
  if (!requests?.length) return undefined;
  return sortRequestsNewestFirst(
    requests.filter((request) => request.type === "cancellation")
  )[0];
}

function readCancelledBy(
  payload: Record<string, unknown> | undefined
): ShiftRequestActorRole | undefined {
  const value = payload?.cancelled_by ?? payload?.cancelledBy;
  if (value === "employee" || value === "manager") return value;
  return undefined;
}

export function resolveLegacyConfirmationStatusFromModel(input: {
  lifecycle: ShiftLifecycleStatus;
  latestConfirmation?: ShiftRequestSummary;
  requestedAt?: string | null;
  now?: Date;
  pendingAfterMinutes?: number;
}): ShiftConfirmationStatus {
  const {
    lifecycle,
    latestConfirmation,
    requestedAt,
    now = new Date(),
    pendingAfterMinutes = DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES,
  } = input;

  if (lifecycle === "cancelled") return "canceled";
  if (lifecycle === "confirmed") return "confirmed";

  if (!latestConfirmation) return "proposed";

  if (latestConfirmation.status === "rejected") return "rejected";
  if (latestConfirmation.status === "approved") return "confirmed";
  if (latestConfirmation.status === "expired") return "pending";
  if (latestConfirmation.status === "pending") {
    const sentAt = latestConfirmation.sent_at ?? requestedAt;
    if (sentAt && isShiftConfirmationPendingDue(sentAt, now, pendingAfterMinutes)) {
      return "pending";
    }
    return "requested";
  }

  return "proposed";
}

export function resolveLegacyConfirmationStatusFromLegacyFields(input: {
  confirmationStatus?: ShiftConfirmationStatus | null;
  requestedAt?: string | null;
  now?: Date;
  pendingAfterMinutes?: number;
}): ShiftConfirmationStatus | undefined {
  const {
    confirmationStatus,
    requestedAt,
    now = new Date(),
    pendingAfterMinutes = DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES,
  } = input;
  if (!confirmationStatus) return undefined;

  if (confirmationStatus === "unresolved") return "unresolved";

  if (confirmationStatus === "requested" && requestedAt) {
    if (isShiftConfirmationPendingDue(requestedAt, now, pendingAfterMinutes)) {
      return "pending";
    }
    return "requested";
  }

  return confirmationStatus;
}

const TERMINAL_LEGACY_CONFIRMATION_STATUSES = new Set<ShiftConfirmationStatus>([
  "confirmed",
  "rejected",
  "canceled",
]);

function resolveLegacyConfirmationStatus(input: {
  legacyFromModel: ShiftConfirmationStatus;
  legacyFromFields?: ShiftConfirmationStatus;
  hasRequests: boolean;
}): ShiftConfirmationStatus {
  if (
    input.legacyFromFields &&
    TERMINAL_LEGACY_CONFIRMATION_STATUSES.has(input.legacyFromFields)
  ) {
    return input.legacyFromFields;
  }

  if (
    input.legacyFromFields === "proposed" &&
    input.legacyFromModel === "confirmed"
  ) {
    return "proposed";
  }

  if (input.hasRequests) return input.legacyFromModel;
  return input.legacyFromFields ?? input.legacyFromModel;
}

export function resolveShiftCardDisplayState(
  input: ShiftDisplayInput,
  now: Date = new Date()
): ShiftCardDisplayState {
  const pendingAfterMinutes =
    input.pendingAfterMinutes ?? DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES;
  const lifecycle = resolveLifecycleFromInput(input);
  const latestConfirmation = latestConfirmationRequest(input.requests);
  const latestCancellation = latestCancellationRequest(input.requests);

  const legacyFromModel = resolveLegacyConfirmationStatusFromModel({
    lifecycle,
    latestConfirmation,
    requestedAt: input.requestedAt,
    now,
    pendingAfterMinutes,
  });

  const legacyFromFields = resolveLegacyConfirmationStatusFromLegacyFields({
    confirmationStatus: input.confirmationStatus,
    requestedAt: input.requestedAt,
    now,
    pendingAfterMinutes,
  });

  const legacyConfirmationStatus = resolveLegacyConfirmationStatus({
    legacyFromModel,
    legacyFromFields,
    hasRequests: input.requests !== undefined,
  });

  const state: ShiftCardDisplayState = {
    shiftId: input.shiftId,
    lifecycle,
    legacyConfirmationStatus,
  };

  if (
    latestConfirmation &&
    OPEN_CONFIRMATION_STATUSES.has(latestConfirmation.status) &&
    latestConfirmation.sent_at &&
    !TERMINAL_LEGACY_CONFIRMATION_STATUSES.has(legacyConfirmationStatus)
  ) {
    state.openConfirmation = {
      requestId: latestConfirmation.id,
      status: latestConfirmation.status as "pending" | "expired",
      sentAt: latestConfirmation.sent_at,
    };
  }

  if (
    latestConfirmation &&
    (latestConfirmation.status === "approved" ||
      latestConfirmation.status === "rejected") &&
    legacyConfirmationStatus !== "proposed"
  ) {
    state.lastConfirmation = {
      requestId: latestConfirmation.id,
      status: latestConfirmation.status as "approved" | "rejected",
      respondedAt: latestConfirmation.responded_at,
    };
  }

  if (
    lifecycle === "cancelled" &&
    latestCancellation?.status === "approved"
  ) {
    state.openCancellation = {
      requestId: latestCancellation.id,
      status: "approved",
      cancelledBy: readCancelledBy(latestCancellation.payload),
    };
  }

  return state;
}

/** Spiegel der SQL-View shifts_with_legacy_confirmation (für Tests/Adapter). */
export function resolveLegacyConfirmationStatusForViewRow(input: {
  lifecycle: ShiftLifecycleStatus;
  latestConfirmationStatus?: ShiftRequestStatus | null;
}): ShiftConfirmationStatus {
  return resolveLegacyConfirmationStatusFromModel({
    lifecycle: input.lifecycle,
    latestConfirmation: input.latestConfirmationStatus
      ? {
          id: "view",
          shift_id: "view",
          type: "confirmation",
          status: input.latestConfirmationStatus,
          sent_at: null,
          responded_at: null,
          payload: {},
          created_at: "1970-01-01T00:00:00.000Z",
        }
      : undefined,
  });
}

export function mapLegacyConfirmationStatusToLifecycleAndRequestStatus(input: {
  confirmationStatus: ShiftConfirmationStatus;
  requestedAt?: string | null;
  confirmationStatusUpdatedAt?: string | null;
  now?: Date;
  pendingAfterMinutes?: number;
}): {
  lifecycle: ShiftLifecycleStatus;
  confirmationRequest?: {
    status: ShiftRequestStatus;
    sentAt: string | null;
    respondedAt: string | null;
  };
} {
  const {
    confirmationStatus,
    requestedAt = null,
    confirmationStatusUpdatedAt = null,
    now = new Date(),
    pendingAfterMinutes = DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES,
  } = input;

  const lifecycle = resolveShiftLifecycleFromLegacy(confirmationStatus);

  if (
    confirmationStatus === "requested" ||
    confirmationStatus === "pending" ||
    confirmationStatus === "rejected" ||
    confirmationStatus === "unresolved"
  ) {
    let status: ShiftRequestStatus;
    if (confirmationStatus === "rejected") {
      status = "rejected";
    } else if (
      confirmationStatus === "pending" ||
      confirmationStatus === "unresolved"
    ) {
      status = "expired";
    } else if (
      requestedAt &&
      isShiftConfirmationPendingDue(requestedAt, now, pendingAfterMinutes)
    ) {
      status = "expired";
    } else {
      status = "pending";
    }

    return {
      lifecycle,
      confirmationRequest: {
        status,
        sentAt: requestedAt,
        respondedAt:
          confirmationStatus === "rejected"
            ? confirmationStatusUpdatedAt
            : null,
      },
    };
  }

  return { lifecycle };
}
