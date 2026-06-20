import type { AreaCalendarShiftRow } from "@schichtwerk/database";

import { resolvePlanningShiftConfirmationFields } from "@/lib/planning-shift-display-state";

export function mapAreaCalendarShiftRowConfirmationFields(row: {
  id: string;
  lifecycle_status?: AreaCalendarShiftRow["lifecycle_status"];
  confirmation_status?: AreaCalendarShiftRow["confirmation_status"];
  requested_at?: string | null;
  confirmation_status_updated_at?: string | null;
  shift_requests?: AreaCalendarShiftRow["shift_requests"];
}) {
  return resolvePlanningShiftConfirmationFields({
    shiftId: row.id,
    lifecycle: row.lifecycle_status,
    confirmationStatus: row.confirmation_status,
    requestedAt: row.requested_at,
    confirmationStatusUpdatedAt: row.confirmation_status_updated_at,
    requests: row.shift_requests,
  });
}
