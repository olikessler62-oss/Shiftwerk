import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";
import type { SwapRequestWithShiftContext } from "@schichtwerk/types";
import { shiftTimeFromTimestamp } from "@/lib/dates";

export function mapSwapRequestToCommunicationRow(
  row: SwapRequestWithShiftContext,
  timeZone: string
): CommunicationSwapRequestRow {
  return {
    id: row.id,
    status: row.status,
    message: row.message,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    targetEmployeeId: row.target_employee_id,
    targetEmployeeName: row.target_name,
    shiftId: row.shift_id,
    shiftDate: row.shift_date,
    startTime: shiftTimeFromTimestamp(row.starts_at, timeZone),
    endTime: shiftTimeFromTimestamp(row.ends_at, timeZone),
    shiftName: row.shift_template_name?.trim() || "—",
    assigneeName: row.assignee_name,
    locationAreaId: row.location_area_id,
    locationId: row.location_id,
  };
}

export function mapSwapRequestsToCommunicationRows(
  rows: readonly SwapRequestWithShiftContext[],
  timeZone: string
): CommunicationSwapRequestRow[] {
  return rows.map((row) => mapSwapRequestToCommunicationRow(row, timeZone));
}
