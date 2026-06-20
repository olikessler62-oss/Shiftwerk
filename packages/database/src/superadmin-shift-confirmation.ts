import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import { resolveShiftLifecycleFromLegacy } from "./shift-display-state";

export const SUPERADMIN_SHIFT_CONFIRMATION_STATUSES: readonly ShiftConfirmationStatus[] =
  ["proposed", "requested", "pending", "confirmed", "rejected", "canceled"];

export function buildSuperadminConfirmationStatusPatch(
  status: ShiftConfirmationStatus,
  now: string
): {
  confirmation_status: ShiftConfirmationStatus;
  confirmation_status_updated_at: string;
  lifecycle_status: ReturnType<typeof resolveShiftLifecycleFromLegacy>;
  requested_at: string | null;
  pending_since: string | null;
  pending_reminder_sent_at: null;
} {
  const base = {
    confirmation_status: status,
    confirmation_status_updated_at: now,
    lifecycle_status: resolveShiftLifecycleFromLegacy(status),
    pending_reminder_sent_at: null as null,
  };

  switch (status) {
    case "proposed":
      return { ...base, requested_at: null, pending_since: null };
    case "requested":
      return { ...base, requested_at: now, pending_since: null };
    case "pending":
      return { ...base, requested_at: now, pending_since: now };
    case "confirmed":
    case "rejected":
    case "canceled":
      return { ...base, requested_at: null, pending_since: null };
  }
}
