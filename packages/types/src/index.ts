export { DEFAULT_SHIFT_TYPES } from "./default-shift-types";
export { DEFAULT_LOCATION_AREAS } from "./default-location-areas";

export type UserRole = "owner" | "manager" | "employee";

export type AvailabilityStatus = "available" | "unavailable" | "preferred";

export type AbsenceType = "vacation" | "sick" | "other";

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type SwapRequestStatus = RequestStatus;

export interface Organization {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  weekly_hours: number | null;
  is_active: boolean;
  created_at: string;
}

export interface ShiftType {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  archived_at: string | null;
}

export interface ShiftTypeBreak {
  id: string;
  shift_type_id: string;
  break_start: string;
  break_end: string;
  sort_order: number;
}

export type ShiftTypeWithBreaks = ShiftType & {
  shift_type_breaks?: ShiftTypeBreak[];
};

export interface Qualification {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
}

export interface Location {
  id: string;
  organization_id: string;
  name: string;
  active_weekdays: string;
  on_holiday_open: boolean;
  sort_order: number;
  archived_at: string | null;
}

export interface LocationArea {
  id: string;
  location_id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
}

/** Personalbedarf: Bereich × Schichtart × Wochentag (Mo=0 … So=6) */
export interface LocationAreaStaffing {
  id: string;
  location_area_id: string;
  shift_type_id: string;
  weekday: number;
  required_count: number;
}

export interface Shift {
  id: string;
  organization_id: string;
  employee_id: string;
  shift_type_id: string;
  location_id: string | null;
  location_area_id: string | null;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  created_by: string | null;
  updated_at: string;
}

export interface Availability {
  id: string;
  organization_id: string;
  employee_id: string;
  available_date: string;
  status: AvailabilityStatus;
}

export interface AbsenceRequest {
  id: string;
  organization_id: string;
  employee_id: string;
  type: AbsenceType;
  start_date: string;
  end_date: string;
  status: RequestStatus;
  reviewed_by: string | null;
  notes: string | null;
}

export interface SwapRequest {
  id: string;
  organization_id: string;
  requester_id: string;
  shift_id: string;
  target_employee_id: string | null;
  status: SwapRequestStatus;
  message: string | null;
  reviewed_by: string | null;
}

export interface DashboardStats {
  shiftsToday: number;
  staffedToday: number;
  openSwaps: number;
  warnings: number;
}
