import type { EmployeeShiftRecord } from "./interface";

export type ShiftDeletionSnapshot = {
  id: string;
  employee_id: string;
  area_shift_template_id: string | null;
  location_id: string | null;
  location_area_id: string | null;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  created_by: string | null;
  confirmation_status?: string;
  requested_at?: string | null;
  pending_since?: string | null;
  pending_reminder_sent_at?: string | null;
};

export function buildShiftDeletionSnapshot(
  shift: EmployeeShiftRecord
): ShiftDeletionSnapshot {
  return {
    id: shift.id,
    employee_id: shift.employee_id,
    area_shift_template_id: shift.area_shift_template_id,
    location_id: shift.location_id,
    location_area_id: shift.location_area_id,
    shift_date: shift.shift_date,
    starts_at: shift.starts_at,
    ends_at: shift.ends_at,
    notes: shift.notes,
    created_by: shift.created_by,
    confirmation_status: shift.confirmation_status,
    requested_at: shift.requested_at,
    pending_since: shift.pending_since,
    pending_reminder_sent_at: shift.pending_reminder_sent_at,
  };
}
