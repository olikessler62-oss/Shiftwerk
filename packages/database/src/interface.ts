import type {
  AvailabilityStatus,
  Profile,
  Shift,
  Qualification,
  Location,
  LocationArea,
  LocationAreaStaffing,
  ShiftType,
  ShiftTypeWithBreaks,
  UserRole,
} from "@schichtwerk/types";

export type { Shift };
import type { Session, User } from "@supabase/supabase-js";

export type ShiftTypeBreakInput = {
  break_start: string;
  break_end: string;
};

export type ShiftWithTypeRow = Shift & {
  shift_types: {
    name: string;
    color: string;
    start_time?: string;
    end_time?: string;
  } | null;
};

export type DashboardShiftRow = {
  id: string;
  employee_id: string;
  location_area_id: string | null;
  shift_date: string;
  shift_types: {
    name: string;
    color: string;
    start_time: string;
    end_time: string;
  } | null;
  profiles: { full_name: string } | null;
};

export type AvailabilityRow = {
  employee_id: string;
  available_date: string;
  status: AvailabilityStatus;
};

export type AuthSignUpResult = {
  user: User;
  session: { access_token: string } | null;
};

export type InviteUserResult = {
  user: User;
};

/**
 * Einzige Schnittstelle zwischen App-Code und Datenbank.
 * SQL-Definition: packages/database/schema.sql
 */
export interface SchichtwerkDatabase {
  // —— Auth (Provider-spezifisch, aktuell Supabase Auth) ——
  authGetSession(): Promise<Session | null>;
  authGetUser(): Promise<User | null>;
  authSignInWithPassword(email: string, password: string): Promise<{ error: string | null }>;
  authSignUp(
    email: string,
    password: string,
    metadata: { full_name: string }
  ): Promise<{ data: AuthSignUpResult | null; error: string | null }>;
  authSignOut(): Promise<void>;
  authExchangeCodeForSession(code: string): Promise<{ error: string | null }>;
  authInviteUserByEmail(
    email: string,
    options: { full_name: string; redirectTo: string }
  ): Promise<{ data: InviteUserResult | null; error: string | null }>;
  authDeleteUser(userId: string): Promise<void>;

  // —— Organizations ——
  createOrganization(name: string): Promise<{ id: string }>;
  deleteOrganization(id: string): Promise<void>;
  getOrganizationName(id: string): Promise<string | null>;

  // —— Profiles ——
  getCurrentUserProfile(): Promise<Profile | null>;
  getProfileById(id: string): Promise<Profile | null>;
  getProfileRole(id: string): Promise<UserRole | null>;
  getProfileOrganizationId(userId: string): Promise<string | null>;
  insertProfile(row: {
    id: string;
    organization_id: string;
    role: UserRole;
    full_name: string;
    email: string;
  }): Promise<void>;
  listActiveEmployees(organizationId: string): Promise<Profile[]>;
  countActiveEmployees(organizationId: string): Promise<number>;
  findProfileByEmail(organizationId: string, email: string): Promise<{ id: string } | null>;
  deactivateEmployee(organizationId: string, employeeId: string): Promise<void>;

  // —— Shift types ——
  listShiftTypes(organizationId: string): Promise<ShiftType[]>;
  listShiftTypesForPlanning(
    organizationId: string,
    from: string,
    to: string
  ): Promise<ShiftType[]>;
  loadShiftTypesWithBreaks(organizationId: string): Promise<ShiftTypeWithBreaks[]>;
  seedDefaultShiftTypes(organizationId: string): Promise<void>;
  getShiftTypeForAssign(
    shiftTypeId: string,
    organizationId: string
  ): Promise<Pick<ShiftType, "id" | "start_time" | "end_time"> | null>;
  getNextShiftTypeSortOrder(organizationId: string): Promise<number>;
  insertShiftType(row: {
    organization_id: string;
    name: string;
    start_time: string;
    end_time: string;
    color: string;
    sort_order: number;
  }): Promise<{ id: string }>;
  updateShiftType(
    id: string,
    organizationId: string,
    row: { name: string; start_time: string; end_time: string }
  ): Promise<void>;
  replaceShiftTypeBreaks(shiftTypeId: string, breaks: ShiftTypeBreakInput[]): Promise<void>;
  countShiftsUsingType(shiftTypeId: string, organizationId: string): Promise<number>;
  archiveShiftType(id: string, organizationId: string): Promise<void>;

  // —— Qualifications ——
  listQualifications(organizationId: string): Promise<Qualification[]>;
  getNextQualificationSortOrder(organizationId: string): Promise<number>;
  insertQualification(row: {
    organization_id: string;
    name: string;
    sort_order: number;
  }): Promise<{ id: string }>;
  updateQualification(
    id: string,
    organizationId: string,
    row: { name: string }
  ): Promise<void>;
  archiveQualification(id: string, organizationId: string): Promise<void>;

  // —— Locations (Standorte) ——
  listLocations(organizationId: string): Promise<Location[]>;
  /** Aktive Standorte plus archivierte, die in der Woche noch Schichten haben. */
  listLocationsForDashboard(
    organizationId: string,
    from: string,
    to: string
  ): Promise<Location[]>;
  getNextLocationSortOrder(organizationId: string): Promise<number>;
  insertLocation(row: {
    organization_id: string;
    name: string;
    active_weekdays: string;
    on_holiday_open: boolean;
    sort_order: number;
  }): Promise<{ id: string }>;
  updateLocation(
    id: string,
    organizationId: string,
    row: {
      name: string;
      active_weekdays: string;
      on_holiday_open: boolean;
    }
  ): Promise<void>;

  listLocationAreas(locationId: string): Promise<LocationArea[]>;
  listLocationAreasForDashboard(
    locationId: string,
    from: string,
    to: string
  ): Promise<LocationArea[]>;
  listLocationAreaStaffing(locationId: string): Promise<LocationAreaStaffing[]>;
  listLocationAreaStaffingForArea(
    locationAreaId: string,
    locationId: string
  ): Promise<LocationAreaStaffing[]>;
  replaceLocationAreaStaffing(
    locationAreaId: string,
    locationId: string,
    rules: { shift_type_id: string; weekday: number; required_count: number }[]
  ): Promise<void>;
  getNextLocationAreaSortOrder(locationId: string): Promise<number>;
  insertLocationArea(row: {
    location_id: string;
    name: string;
    sort_order: number;
  }): Promise<{ id: string }>;
  updateLocationArea(
    id: string,
    locationId: string,
    row: { name: string }
  ): Promise<void>;
  archiveLocationArea(id: string, locationId: string): Promise<void>;
  archiveLocation(id: string, organizationId: string): Promise<void>;

  // —— Shifts ——
  /** Eigene Schichten (Mitarbeiter-App, gefiltert per RLS) */
  listMyShifts(fromDate: string, toDate: string): Promise<Shift[]>;
  listShiftsForWeek(
    organizationId: string,
    from: string,
    to: string
  ): Promise<ShiftWithTypeRow[]>;
  listDashboardShifts(
    organizationId: string,
    from: string,
    to: string,
    locationId: string
  ): Promise<DashboardShiftRow[]>;
  getShiftById(
    id: string,
    organizationId: string
  ): Promise<{ id: string; shift_date: string } | null>;
  findShiftByEmployeeDate(
    employeeId: string,
    shiftDate: string
  ): Promise<{ id: string; location_id: string | null } | null>;
  insertShift(row: {
    organization_id: string;
    employee_id: string;
    shift_type_id: string;
    location_id: string;
    shift_date: string;
    starts_at: string;
    ends_at: string;
    created_by: string;
  }): Promise<void>;
  updateShift(
    id: string,
    row: {
      shift_type_id: string;
      location_id: string;
      starts_at: string;
      ends_at: string;
      created_by: string;
    }
  ): Promise<void>;
  deleteShift(id: string, organizationId: string): Promise<void>;

  // —— Availability ——
  listAvailabilityForWeek(
    organizationId: string,
    from: string,
    to: string
  ): Promise<AvailabilityRow[]>;

  // —— Manager layout ——
  getManagerProfile(userId: string): Promise<Profile | null>;
}
