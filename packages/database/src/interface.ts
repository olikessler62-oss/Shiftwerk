import type {
  AvailabilityStatus,
  AbsenceRequest,
  AbsenceType,
  Profile,
  ProfileHourlyRate,
  ProfileHourlyRateSummary,
  ProfileRecurringAvailability,
  Shift,
  Qualification,
  Role,
  RolePermissionLevel,
  Location,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaServiceHour,
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
  shift_type_id: string | null;
  shift_date: string;
  starts_at?: string;
  ends_at?: string;
  shift_types: {
    name: string;
    color: string;
    start_time: string;
    end_time: string;
  } | null;
  profiles: { full_name: string; color?: string | null } | null;
};

export type EmployeeShiftRecord = {
  id: string;
  employee_id: string;
  shift_type_id: string | null;
  location_id: string | null;
  location_area_id: string | null;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  created_by: string | null;
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
  authResetPasswordForEmail(
    email: string,
    redirectTo: string
  ): Promise<{ error: string | null }>;
  authUpdatePassword(password: string): Promise<{ error: string | null }>;
  authUpdateEmail(email: string): Promise<{ error: string | null }>;
  authAdminUpdateUserEmail(
    userId: string,
    email: string
  ): Promise<{ error: string | null }>;
  authExchangeCodeForSession(code: string): Promise<{ error: string | null }>;
  authInviteUserByEmail(
    email: string,
    options: { full_name: string; redirectTo: string }
  ): Promise<{ data: InviteUserResult | null; error: string | null }>;
  authAdminCreateUser(
    email: string,
    options: { full_name: string; password?: string }
  ): Promise<{ data: InviteUserResult | null; error: string | null }>;
  authDeleteUser(userId: string): Promise<void>;

  // —— Organizations ——
  createOrganization(name: string): Promise<{ id: string }>;
  deleteOrganization(id: string): Promise<void>;
  getOrganizationName(id: string): Promise<string | null>;
  getOrganizationIdByProfileEmail(email: string): Promise<string | null>;
  getFirstOrganization(): Promise<{ id: string; name: string } | null>;

  // —— Profiles ——
  getCurrentUserProfile(): Promise<Profile | null>;
  updateCurrentUserProfileEmail(
    newEmail: string
  ): Promise<
    | { ok: true; profile: Profile; confirmationRequired: boolean }
    | { ok: false; error: string }
  >;
  getProfileById(id: string): Promise<Profile | null>;
  getProfileRole(id: string): Promise<UserRole | null>;
  getProfileOrganizationId(userId: string): Promise<string | null>;
  insertProfile(row: {
    id: string;
    organization_id: string;
    role_id?: string;
    role?: RolePermissionLevel;
    full_name: string;
    email: string;
    mobile_phone?: string | null;
    color?: string | null;
    is_active?: boolean;
    schedulable?: boolean;
  }): Promise<void>;
  updateOrganizationProfile(
    id: string,
    organizationId: string,
    row: {
      full_name: string;
      is_active: boolean;
      schedulable: boolean;
      email: string;
      mobile_phone: string | null;
      color: string | null;
    }
  ): Promise<void>;
  listAssignedProfileColors(
    organizationId: string,
    excludeProfileId?: string
  ): Promise<string[]>;
  getRoleIdByPermissionLevel(
    organizationId: string,
    permissionLevel: RolePermissionLevel
  ): Promise<string | null>;
  listOrganizationProfiles(organizationId: string): Promise<Profile[]>;
  listActiveEmployees(organizationId: string): Promise<Profile[]>;
  getNextProfileSortOrder(organizationId: string): Promise<number>;
  reorderProfiles(organizationId: string, orderedIds: string[]): Promise<void>;
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
  loadShiftTypesWithBreaksForDashboard(
    organizationId: string,
    staffingRules: { shift_type_id: string; required_count: number }[]
  ): Promise<ShiftTypeWithBreaks[]>;
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
  reorderShiftTypes(organizationId: string, orderedIds: string[]): Promise<void>;

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
  countUpcomingShiftsForQualificationProfiles(
    organizationId: string,
    qualificationId: string,
    fromDate: string
  ): Promise<number>;
  archiveQualification(id: string, organizationId: string): Promise<void>;
  reorderQualifications(organizationId: string, orderedIds: string[]): Promise<void>;

  // —— Profile qualifications ——
  listProfileQualifications(
    organizationId: string,
    profileId: string
  ): Promise<Qualification[]>;
  assignProfileQualification(
    organizationId: string,
    profileId: string,
    qualificationId: string
  ): Promise<void>;
  removeProfileQualification(
    organizationId: string,
    profileId: string,
    qualificationId: string
  ): Promise<void>;

  // —— Profile hourly rates ——
  getServerDateIso(): Promise<string>;
  getProfileHourlyRateById(
    organizationId: string,
    profileId: string,
    rateId: string
  ): Promise<ProfileHourlyRate | null>;
  listProfileHourlyRates(
    organizationId: string,
    profileId: string,
    limit?: number
  ): Promise<ProfileHourlyRate[]>;
  getProfileHourlyRateForDate(
    organizationId: string,
    profileId: string,
    date: string
  ): Promise<ProfileHourlyRate | null>;
  listCurrentOrganizationProfileHourlyRates(
    organizationId: string,
    date: string
  ): Promise<ProfileHourlyRateSummary[]>;
  setProfileHourlyRate(
    organizationId: string,
    profileId: string,
    input: {
      amount: number;
      valid_from: string;
      created_by: string;
    }
  ): Promise<ProfileHourlyRate>;
  updateProfileHourlyRate(
    organizationId: string,
    profileId: string,
    rateId: string,
    input: {
      amount: number;
      valid_from: string;
    },
    referenceDate: string
  ): Promise<ProfileHourlyRate>;
  deleteProfileHourlyRate(
    organizationId: string,
    profileId: string,
    rateId: string,
    referenceDate: string
  ): Promise<void>;

  // —— Profile recurring availability ——
  listProfileRecurringAvailability(
    organizationId: string,
    profileId: string
  ): Promise<ProfileRecurringAvailability[]>;
  listOrganizationRecurringAvailability(
    organizationId: string
  ): Promise<ProfileRecurringAvailability[]>;
  listEmployeeIdsWithShiftOnDate(
    organizationId: string,
    date: string
  ): Promise<string[]>;
  listEmployeeLastShiftDates(
    organizationId: string
  ): Promise<Record<string, string>>;
  insertProfileRecurringAvailability(
    organizationId: string,
    profileId: string,
    input: {
      weekday: number;
      start_time: string;
      end_time: string;
      shift_type_id?: string | null;
    }
  ): Promise<ProfileRecurringAvailability>;
  updateProfileRecurringAvailability(
    organizationId: string,
    profileId: string,
    availabilityId: string,
    input: {
      weekday: number;
      start_time: string;
      end_time: string;
      shift_type_id?: string | null;
    }
  ): Promise<ProfileRecurringAvailability>;
  deleteProfileRecurringAvailability(
    organizationId: string,
    profileId: string,
    availabilityId: string
  ): Promise<void>;
  reorderProfileRecurringAvailability(
    organizationId: string,
    profileId: string,
    orderedIds: string[]
  ): Promise<void>;

  // —— Roles ——
  listRoles(organizationId: string): Promise<Role[]>;
  seedDefaultRoles(organizationId: string): Promise<void>;
  getNextRoleSortOrder(organizationId: string): Promise<number>;
  insertRole(row: {
    organization_id: string;
    key: string;
    name: string;
    permission_level: RolePermissionLevel;
    is_system?: boolean;
    sort_order: number;
  }): Promise<{ id: string }>;
  updateRole(
    id: string,
    organizationId: string,
    row: {
      name: string;
      permission_level: RolePermissionLevel;
    }
  ): Promise<void>;
  archiveRole(id: string, organizationId: string): Promise<void>;
  countProfilesUsingRole(roleId: string, organizationId: string): Promise<number>;
  reorderRoles(organizationId: string, orderedIds: string[]): Promise<void>;

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
    sort_order: number;
  }): Promise<{ id: string }>;
  updateLocation(
    id: string,
    organizationId: string,
    row: { name: string }
  ): Promise<void>;
  listLocationAreaServiceHours(
    locationId: string
  ): Promise<LocationAreaServiceHour[]>;
  listLocationAreaServiceHoursForArea(
    locationAreaId: string,
    locationId: string
  ): Promise<LocationAreaServiceHour[]>;
  replaceLocationAreaServiceHours(
    locationAreaId: string,
    locationId: string,
    rows: { weekday: number; start_time: string; end_time: string }[]
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
    rules: {
      shift_type_id: string;
      weekday: number;
      qualification_id: string;
      required_count: number;
    }[]
  ): Promise<void>;
  saveLocationAreaStaffingForShiftType(
    locationAreaId: string,
    locationId: string,
    shiftTypeId: string,
    rules: {
      weekday: number;
      qualification_id: string;
      required_count: number;
    }[]
  ): Promise<void>;
  removeLocationAreaStaffingForShiftType(
    locationAreaId: string,
    locationId: string,
    shiftTypeId: string
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
  reorderLocationAreas(locationId: string, orderedIds: string[]): Promise<void>;
  reorderLocations(organizationId: string, orderedIds: string[]): Promise<void>;
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
  listShiftsForEmployeeDate(
    employeeId: string,
    shiftDate: string
  ): Promise<EmployeeShiftRecord[]>;
  getShiftRecordById(
    id: string,
    organizationId: string
  ): Promise<EmployeeShiftRecord | null>;
  listProfileQualificationIdsByOrganization(
    organizationId: string
  ): Promise<Map<string, string[]>>;
  insertShift(row: {
    organization_id: string;
    employee_id: string;
    shift_type_id: string | null;
    location_id: string;
    location_area_id?: string | null;
    shift_date: string;
    starts_at: string;
    ends_at: string;
    created_by: string;
  }): Promise<{ id: string }>;
  updateShift(
    id: string,
    row: {
      shift_type_id: string | null;
      location_id: string;
      location_area_id?: string | null;
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

  // —— Absence requests ——
  listOrganizationAbsences(
    organizationId: string,
    status?: "approved" | "pending" | "rejected" | "cancelled"
  ): Promise<AbsenceRequest[]>;

  insertAbsenceRequest(row: {
    organization_id: string;
    employee_id: string;
    type: AbsenceType;
    start_date: string;
    end_date: string;
    status: "approved";
    notes: string | null;
    reviewed_by: string;
  }): Promise<string>;

  updateAbsenceRequest(
    id: string,
    organizationId: string,
    row: {
      employee_id: string;
      type: AbsenceType;
      start_date: string;
      end_date: string;
      status: "approved";
      notes: string | null;
      reviewed_by: string;
    }
  ): Promise<void>;

  deleteAbsenceRequest(id: string, organizationId: string): Promise<void>;

  countShiftsConflictingWithAbsenceRanges(
    organizationId: string,
    ranges: { employee_id: string; start_date: string; end_date: string }[]
  ): Promise<number>;

  // —— Manager layout ——
  getManagerProfile(userId: string): Promise<Profile | null>;
}
