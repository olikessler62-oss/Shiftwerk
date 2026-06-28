import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export type SuperadminShiftRecord = {
  id: string;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  confirmation_status: ShiftConfirmationStatus;
  confirmation_status_updated_at: string | null;
  requested_at: string | null;
  employee_id: string;
  employee_name: string;
  location_id: string | null;
  location_name: string | null;
  location_area_id: string | null;
  area_name: string | null;
  template_name: string | null;
};

export type SuperadminShiftListRow = {
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  confirmationStatus: ShiftConfirmationStatus;
  employeeId: string;
  employeeName: string;
  locationName: string | null;
  areaName: string | null;
  templateName: string | null;
  locationAreaLabel: string;
};
