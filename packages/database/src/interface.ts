import type {
  AbsenceRequest,
  AbsenceType,
  Profile,
  ProfileHourlyRate,
  ProfileHourlyRateSummary,
  ProfileCompensationSurcharge,
  EffectiveProfileCompensationSurcharge,
  CompensationSurchargeType,
  CompensationSurchargeUnit,
  ProfileRecurringAvailability,
  ProfileShiftPreference,
  Shift,
  Qualification,
  Role,
  RolePermissionLevel,
  Location,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  LocationAreaServiceHour,
  UserRole,
  Organization,
  PlanningMode,
  Industry,
  ConfirmationRequestScope,
} from "@schichtwerk/types";
import type { ShiftConfirmationSnapshot } from "./shift-confirmation-snapshot";
import type {
  ProposedShiftForSend,
  ConfirmationSendModalShiftRecord,
} from "./shift-confirmation-send";
import type { ShiftConfirmationPendingJobResult } from "./shift-confirmation-pending";

export type { ShiftConfirmationPendingJobResult };

export type { Shift };
import type { Session, User } from "@supabase/supabase-js";

export type ShiftTypeBreakInput = {
  break_start: string;
  break_end: string;
};

export type AreaCalendarShiftRow = {
  id: string;
  employee_id: string;
  location_area_id: string | null;
  area_shift_template_id: string | null;
  shift_date: string;
  starts_at?: string;
  ends_at?: string;
  confirmation_status?: import("@schichtwerk/types").ShiftConfirmationStatus;
  confirmation_status_updated_at?: string;
  requested_at?: string | null;
  pending_since?: string | null;
  lifecycle_status?: import("@schichtwerk/types").ShiftLifecycleStatus;
  shift_requests?: import("./shift-display-state").ShiftRequestSummary[];
  area_shift_templates: {
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
  area_shift_template_id: string | null;
  location_id: string | null;
  location_area_id: string | null;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  created_by: string | null;
  confirmation_status?: import("@schichtwerk/types").ShiftConfirmationStatus;
  lifecycle_status?: import("@schichtwerk/types").ShiftLifecycleStatus;
  requested_at?: string | null;
  pending_since?: string | null;
  pending_reminder_sent_at?: string | null;
};

export type ShiftConfirmationWriteFields = {
  confirmation_status?: import("@schichtwerk/types").ShiftConfirmationStatus;
  confirmation_status_updated_at?: string;
  requested_at?: string | null;
  pending_since?: string | null;
  pending_reminder_sent_at?: string | null;
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
  createOrganization(
    name: string,
    countryCode?: string,
    options?: {
      planningMode?: PlanningMode;
      industry?: Industry | null;
    }
  ): Promise<{ id: string }>;
  deleteOrganization(id: string): Promise<void>;
  getOrganization(id: string): Promise<Organization | null>;
  getOrganizationName(id: string): Promise<string | null>;
  getOrganizationCountryCode(id: string): Promise<string | null>;
  updateOrganizationPlanningMode(
    organizationId: string,
    planningMode: PlanningMode
  ): Promise<void>;
  updateOrganizationAllowRetroactiveCompensationEntries(
    organizationId: string,
    allowed: boolean
  ): Promise<void>;
  updateOrganizationShiftConfirmationEnabled(
    organizationId: string,
    enabled: boolean
  ): Promise<void>;
  updateOrganizationShiftConfirmationDisclaimer(
    organizationId: string,
    disclaimer: string | null
  ): Promise<void>;
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
    weekly_hours?: number | null;
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
      weekly_hours?: number | null;
      email_fallback_mode?: boolean;
    }
  ): Promise<void>;
  /** Superadmin: Schicht-/Benachrichtigungs-Simulation pro Profil. */
  updateProfileSuperadminSimulationSettings(
    id: string,
    organizationId: string,
    row: {
      is_active: boolean;
      schedulable: boolean;
      app_registered_at: string | null;
      email_fallback_mode: boolean;
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
  /** Aktive, planbare Profile (Mitarbeiter + Admins/Manager mit schedulable). */
  listPlanningEmployees(organizationId: string): Promise<Profile[]>;
  getNextProfileSortOrder(organizationId: string): Promise<number>;
  reorderProfiles(organizationId: string, orderedIds: string[]): Promise<void>;
  countActiveEmployees(organizationId: string): Promise<number>;
  findProfileByEmail(organizationId: string, email: string): Promise<{ id: string } | null>;
  deactivateEmployee(organizationId: string, employeeId: string): Promise<void>;
  /** Löscht Auth-User (cascade Profile) nach Aufräumen von RESTRICT-FKs. */
  hardDeleteOrganizationProfile(
    organizationId: string,
    profileId: string
  ): Promise<void>;

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
  listAllOrganizationProfileHourlyRates(
    organizationId: string
  ): Promise<ProfileHourlyRate[]>;
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
    }
  ): Promise<ProfileHourlyRate>;
  deleteProfileHourlyRate(
    organizationId: string,
    profileId: string,
    rateId: string
  ): Promise<void>;

  // —— Compensation surcharge types ——
  listCompensationSurchargeTypes(
    organizationId: string
  ): Promise<CompensationSurchargeType[]>;
  getNextCompensationSurchargeTypeSortOrder(
    organizationId: string
  ): Promise<number>;
  insertCompensationSurchargeType(row: {
    organization_id: string;
    name: string;
    trigger: CompensationSurchargeType["trigger"];
    amount: number;
    unit: CompensationSurchargeType["unit"];
    sort_order: number;
  }): Promise<{ id: string }>;
  updateCompensationSurchargeType(
    id: string,
    organizationId: string,
    row: {
      name: string;
      trigger: CompensationSurchargeType["trigger"];
      amount: number;
      unit: CompensationSurchargeType["unit"];
    }
  ): Promise<void>;
  archiveCompensationSurchargeType(
    id: string,
    organizationId: string
  ): Promise<void>;
  reorderCompensationSurchargeTypes(
    organizationId: string,
    orderedIds: string[]
  ): Promise<void>;

  // —— Profile compensation surcharges ——
  listProfileCompensationSurcharges(
    organizationId: string,
    profileId: string,
    limit?: number
  ): Promise<ProfileCompensationSurcharge[]>;
  listAllOrganizationProfileCompensationSurcharges(
    organizationId: string
  ): Promise<ProfileCompensationSurcharge[]>;
  listEffectiveProfileCompensationSurchargesForDate(
    organizationId: string,
    profileId: string,
    date: string
  ): Promise<EffectiveProfileCompensationSurcharge[]>;
  getProfileCompensationSurchargeById(
    organizationId: string,
    profileId: string,
    entryId: string
  ): Promise<ProfileCompensationSurcharge | null>;
  setProfileCompensationSurcharge(
    organizationId: string,
    profileId: string,
    input: {
      surcharge_type_id: string;
      amount: number | null;
      unit: CompensationSurchargeUnit | null;
      valid_from: string;
      created_by: string;
    }
  ): Promise<ProfileCompensationSurcharge>;
  updateProfileCompensationSurcharge(
    organizationId: string,
    profileId: string,
    entryId: string,
    input: {
      amount: number | null;
      unit: CompensationSurchargeUnit | null;
      valid_from: string;
    },
    referenceDate: string
  ): Promise<ProfileCompensationSurcharge>;
  deleteProfileCompensationSurcharge(
    organizationId: string,
    profileId: string,
    entryId: string,
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

  // —— Profile shift preferences (Wunsch-Einsatzzeiten) ——
  listProfileShiftPreferences(
    organizationId: string,
    profileId: string
  ): Promise<ProfileShiftPreference[]>;
  listOrganizationShiftPreferences(
    organizationId: string,
    weekday: number
  ): Promise<ProfileShiftPreference[]>;
  listAllOrganizationShiftPreferences(
    organizationId: string
  ): Promise<ProfileShiftPreference[]>;
  insertProfileShiftPreference(
    organizationId: string,
    profileId: string,
    input: {
      weekday?: number | null;
      start_time?: string | null;
      end_time?: string | null;
      location_id?: string | null;
      location_area_id?: string | null;
      qualification_id?: string | null;
      priority?: number;
    }
  ): Promise<ProfileShiftPreference>;
  updateProfileShiftPreference(
    organizationId: string,
    profileId: string,
    preferenceId: string,
    input: {
      weekday?: number | null;
      start_time?: string | null;
      end_time?: string | null;
      location_id?: string | null;
      location_area_id?: string | null;
      qualification_id?: string | null;
      priority?: number;
    }
  ): Promise<ProfileShiftPreference>;
  deleteProfileShiftPreference(
    organizationId: string,
    profileId: string,
    preferenceId: string
  ): Promise<void>;

  // —— Roles ——
  listRoles(organizationId: string): Promise<Role[]>;
  seedDefaultRoles(organizationId: string): Promise<void>;
  seedOrganizationFromIndustryTemplate(
    organizationId: string,
    orgName: string,
    industry: Industry
  ): Promise<void>;
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
  listLocationsForAreaCalendar(
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
  listLocationAreaServiceHoursForAreas(
    areaIds: readonly string[]
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
  ensureLocationAreaServiceHour(
    locationAreaId: string,
    locationId: string,
    row: { weekday: number; start_time: string; end_time: string },
    options?: { excludeServiceHourId?: string }
  ): Promise<LocationAreaServiceHour>;

  listLocationAreas(locationId: string): Promise<LocationArea[]>;
  listLocationAreasForAreaCalendar(
    locationId: string,
    from: string,
    to: string
  ): Promise<LocationArea[]>;
  listLocationAreaStaffing(locationId: string): Promise<LocationAreaStaffing[]>;
  listLocationAreaStaffingForAreas(
    areaIds: readonly string[]
  ): Promise<LocationAreaStaffing[]>;
  listLocationAreaStaffingForArea(
    locationAreaId: string,
    locationId: string
  ): Promise<LocationAreaStaffing[]>;
  replaceLocationAreaStaffing(
    locationAreaId: string,
    locationId: string,
    rules: {
      service_hour_id: string;
      qualification_id: string;
      required_count: number;
    }[]
  ): Promise<void>;
  saveLocationAreaStaffingForServiceHour(
    serviceHourId: string,
    locationId: string,
    rules: {
      qualification_id: string;
      required_count: number;
    }[]
  ): Promise<void>;
  removeLocationAreaStaffingForServiceHour(
    serviceHourId: string,
    locationId: string
  ): Promise<void>;
  listLocationAreaStaffingOverrides(
    locationId: string,
    from: string,
    to: string
  ): Promise<LocationAreaStaffingOverride[]>;
  replaceLocationAreaStaffingOverridesForServiceHourDate(
    locationAreaId: string,
    locationId: string,
    shiftDate: string,
    serviceHourId: string,
    rules: {
      qualification_id: string;
      required_count: number;
    }[]
  ): Promise<void>;
  listAreaShiftTemplatesWithBreaksForArea(
    locationAreaId: string,
    locationId: string
  ): Promise<import("@schichtwerk/types").AreaShiftTemplateWithBreaks[]>;
  listAreaShiftTemplatesWithBreaksForLocation(
    locationId: string
  ): Promise<import("@schichtwerk/types").AreaShiftTemplateWithBreaks[]>;
  getNextAreaShiftTemplateSortOrder(
    locationAreaId: string,
    locationId: string
  ): Promise<number>;
  insertAreaShiftTemplate(row: {
    location_area_id: string;
    name: string;
    start_time: string;
    end_time: string;
    color: string;
    sort_order: number;
  }): Promise<{ id: string }>;
  updateAreaShiftTemplate(
    id: string,
    locationAreaId: string,
    locationId: string,
    row: { name: string; start_time: string; end_time: string; color?: string }
  ): Promise<void>;
  replaceAreaShiftTemplateBreaks(
    templateId: string,
    breaks: ShiftTypeBreakInput[]
  ): Promise<void>;
  archiveAreaShiftTemplate(
    id: string,
    locationAreaId: string,
    locationId: string
  ): Promise<void>;
  clearAreaShiftTemplatesForArea(
    locationAreaId: string,
    locationId: string
  ): Promise<void>;
  reorderAreaShiftTemplates(
    locationAreaId: string,
    locationId: string,
    orderedIds: string[]
  ): Promise<void>;
  listAreaQualificationTemplatesForArea(
    locationAreaId: string,
    locationId: string
  ): Promise<import("@schichtwerk/types").AreaQualificationTemplateEntry[]>;
  listAreaQualificationTemplatesForLocation(
    locationId: string
  ): Promise<import("@schichtwerk/types").AreaQualificationTemplateEntry[]>;
  getNextAreaQualificationTemplateSortOrder(
    locationAreaId: string,
    locationId: string
  ): Promise<number>;
  assignAreaQualificationTemplate(
    organizationId: string,
    locationAreaId: string,
    locationId: string,
    qualificationId: string
  ): Promise<void>;
  removeAreaQualificationTemplate(
    locationAreaId: string,
    locationId: string,
    templateId: string
  ): Promise<void>;
  reorderAreaQualificationTemplates(
    locationAreaId: string,
    locationId: string,
    orderedIds: string[]
  ): Promise<void>;
  getNextLocationAreaSortOrder(locationId: string): Promise<number>;
  insertLocationArea(row: {
    location_id: string;
    name: string;
    sort_order: number;
    planning_mode?: import("@schichtwerk/types").AreaPlanningMode;
  }): Promise<{ id: string }>;
  updateLocationArea(
    id: string,
    locationId: string,
    row: {
      name: string;
      planning_mode?: import("@schichtwerk/types").AreaPlanningMode;
    }
  ): Promise<void>;
  archiveLocationArea(id: string, locationId: string): Promise<void>;
  reorderLocationAreas(locationId: string, orderedIds: string[]): Promise<void>;
  reorderLocations(organizationId: string, orderedIds: string[]): Promise<void>;
  archiveLocation(id: string, organizationId: string): Promise<void>;

  // —— Shifts ——
  /** Eigene Schichten (Mitarbeiter-App, gefiltert per RLS) */
  listMyShifts(fromDate: string, toDate: string): Promise<Shift[]>;
  /** Anzeige-Metadaten für den Mitarbeiter-Wochenplan (Bereich, Vorlage, Farbe). */
  listMyShiftWeekDisplay(
    fromDate: string,
    toDate: string
  ): Promise<import("@schichtwerk/types").EmployeeWeekShiftDisplayItem[]>;
  listAreaCalendarShifts(
    organizationId: string,
    from: string,
    to: string,
    locationId: string
  ): Promise<AreaCalendarShiftRow[]>;
  getShiftById(
    id: string,
    organizationId: string
  ): Promise<{ id: string; shift_date: string } | null>;
  listShiftsForEmployeeDate(
    employeeId: string,
    shiftDate: string
  ): Promise<EmployeeShiftRecord[]>;
  listShiftsForEmployeeOnDates(
    employeeId: string,
    shiftDates: string[]
  ): Promise<EmployeeShiftRecord[]>;
  listShiftsForEmployeeFromDate(
    employeeId: string,
    fromDate: string
  ): Promise<EmployeeShiftRecord[]>;
  listShiftsForEmployeeInDateRange(
    employeeId: string,
    fromDate: string,
    toDate: string
  ): Promise<EmployeeShiftRecord[]>;
  /** Schichten mit End-/Startfenster vor/nach der neuen Schicht (für Ruhezeitprüfung). */
  listShiftsForEmployeeRestCheck(
    employeeId: string,
    startsAt: string,
    endsAt: string,
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
    area_shift_template_id?: string | null;
    location_id: string;
    location_area_id?: string | null;
    shift_date: string;
    starts_at: string;
    ends_at: string;
    created_by: string;
  } & ShiftConfirmationWriteFields): Promise<{ id: string }>;
  updateShift(
    id: string,
    row: {
      area_shift_template_id?: string | null;
      location_id: string;
      location_area_id?: string | null;
      starts_at: string;
      ends_at: string;
      created_by: string;
    } & ShiftConfirmationWriteFields
  ): Promise<void>;
  deleteShift(id: string, organizationId: string, deletedBy: string): Promise<void>;

  listProposedShiftsForConfirmationSend(
    organizationId: string,
    options: {
      weekStart: string;
      weekEnd: string;
      locationId?: string;
      employeeId?: string;
    }
  ): Promise<ProposedShiftForSend[]>;

  listShiftsForConfirmationSendModal(
    organizationId: string,
    options: {
      weekStart: string;
      weekEnd: string;
      locationId?: string;
    }
  ): Promise<ConfirmationSendModalShiftRecord[]>;

  getLatestConfirmationSnapshotsByShiftIds(
    shiftIds: string[]
  ): Promise<Map<string, ShiftConfirmationSnapshot>>;

  sendConfirmationRequestForEmployee(input: {
    organizationId: string;
    employeeId: string;
    sentBy: string;
    scope: ConfirmationRequestScope;
    weekStart: string;
    weekEnd: string;
    shifts: ProposedShiftForSend[];
    profile: Pick<Profile, "email_fallback_mode">;
    skipNotificationOutbox?: boolean;
  }): Promise<{ batchId: string; sentCount: number; isDelta: boolean }>;

  resendConfirmationRequestsForShifts(input: {
    organizationId: string;
    sentBy: string;
    shiftIds: string[];
  }): Promise<{
    sentCount: number;
    failed: Array<{ shiftId: string; error: string }>;
  }>;

  runShiftConfirmationPendingJob(
    now?: Date
  ): Promise<ShiftConfirmationPendingJobResult>;

  runShiftUnresolvedPastJob(
    now?: Date
  ): Promise<import("./shift-unresolved-status").ShiftUnresolvedPastJobResult>;

  runShiftPastProposedCleanupJob(
    now?: Date
  ): Promise<import("./shift-past-proposed-cleanup").ShiftPastProposedCleanupJobResult>;

  listManagerNotificationsForRecipient(
    recipientProfileId: string,
    options?: { limit?: number; includeDismissed?: boolean }
  ): Promise<import("@schichtwerk/types").ManagerNotification[]>;

  dismissManagerNotification(
    notificationId: string,
    recipientProfileId: string
  ): Promise<void>;

  insertManagerNotifications(
    organizationId: string,
    rows: {
      recipient_profile_id: string;
      type: string;
      title: string;
      body: string;
      payload: Record<string, unknown>;
    }[]
  ): Promise<void>;

  insertNotificationOutboxEntries(
    organizationId: string,
    rows: {
      recipient_profile_id: string;
      channel: import("@schichtwerk/types").NotificationOutboxChannel;
      template_key: string;
      payload: Record<string, unknown>;
      simulated: boolean;
    }[]
  ): Promise<void>;

  listNotificationOutboxEntries(
    organizationId: string,
    options?: { limit?: number }
  ): Promise<
    (import("@schichtwerk/types").NotificationOutboxEntry & {
      recipient_full_name: string;
    })[]
  >;

  listEmployeeConfirmationWeekItems(
    employeeId: string,
    organizationId: string,
    from: string,
    to: string,
    organizationDisclaimer: string | null
  ): Promise<import("@schichtwerk/types").ConfirmationWeekResponse>;

  listEmployeePendingConfirmationItems(
    employeeId: string,
    organizationId: string,
    fromDate: string,
    organizationDisclaimer: string | null
  ): Promise<import("@schichtwerk/types").ConfirmationWeekResponse>;

  listEmployeeManagerCanceledShiftNotifications(input: {
    employeeId: string;
    organizationId: string;
    fromDate: string;
  }): Promise<
    import("@schichtwerk/types").EmployeeShiftCanceledNotificationItem[]
  >;

  getEmployeeConfirmationShiftItem(
    employeeId: string,
    organizationId: string,
    shiftId: string,
    organizationDisclaimer: string | null
  ): Promise<import("@schichtwerk/types").ConfirmationWeekItem | null>;

  submitEmployeeConfirmationResponses(input: {
    organizationId: string;
    employeeId: string;
    employeeName: string;
    items: import("@schichtwerk/types").ConfirmationRespondItem[];
  }): Promise<{
    updatedCount: number;
    updatedShifts: { locationId: string | null; shiftDate: string }[];
  }>;

  cancelShift(input: {
    organizationId: string;
    shiftId: string;
    actorId: string;
    actorRole: "manager" | "employee";
    employeeName?: string;
  }): Promise<{
    locationId: string | null;
    shiftDate: string;
    employeeId: string;
  }>;

  dismissCanceledShiftFromEmployeeView(input: {
    organizationId: string;
    shiftId: string;
    employeeId: string;
  }): Promise<{ shiftDate: string }>;

  confirmPastShiftAsManager(input: {
    organizationId: string;
    shiftId: string;
    actorId: string;
  }): Promise<{
    locationId: string | null;
    shiftDate: string;
  }>;

  listOrganizationShiftsForSuperadmin(organizationId: string): Promise<
    import("./superadmin-shifts").SuperadminShiftRecord[]
  >;

  updateShiftConfirmationStatusAsSuperadmin(input: {
    organizationId: string;
    shiftId: string;
    actorId: string;
    confirmationStatus: import("@schichtwerk/types").ShiftConfirmationStatus;
  }): Promise<{
    locationId: string | null;
    shiftDate: string;
  }>;

  resetOrganizationOperationalData(organizationId: string): Promise<void>;

  resetOrganizationShiftData(
    organizationId: string,
    options?: { deleteShifts?: boolean }
  ): Promise<void>;

  saveOrganizationShiftSnapshot(organizationId: string): Promise<number>;

  restoreOrganizationShiftSnapshot(organizationId: string): Promise<number>;

  clearOrganizationShiftSnapshot(organizationId: string): Promise<void>;

  getOrganizationShiftSnapshotMeta(
    organizationId: string
  ): Promise<{ savedAt: string; shiftCount: number } | null>;

  // —— Absence requests ——
  listOrganizationAbsences(
    organizationId: string,
    options?: {
      statuses?: import("@schichtwerk/types").RequestStatus[];
      employeeId?: string;
      /** Nur Abwesenheiten, die diesen Zeitraum überlappen (z. B. Planungswoche). */
      overlappingFrom?: string;
      overlappingTo?: string;
    }
  ): Promise<AbsenceRequest[]>;

  insertAbsenceRequest(row: {
    organization_id: string;
    employee_id: string;
    type: AbsenceType;
    start_date: string;
    end_date: string | null;
    is_open_ended: boolean;
    expected_end_date: string | null;
    status: import("@schichtwerk/types").RequestStatus;
    notes: string | null;
    reviewed_by: string | null;
    reported_by: string | null;
  }): Promise<string>;

  updateAbsenceRequest(
    id: string,
    organizationId: string,
    row: {
      employee_id: string;
      type: AbsenceType;
      start_date: string;
      end_date: string | null;
      is_open_ended: boolean;
      expected_end_date: string | null;
      status: import("@schichtwerk/types").RequestStatus;
      notes: string | null;
      reviewed_by: string | null;
      reported_by?: string | null;
    }
  ): Promise<void>;

  deleteAbsenceRequest(id: string, organizationId: string): Promise<void>;

  purgeExpiredAbsenceRequestsBatch(
    purgeCutoffISO: string,
    batchSize?: number
  ): Promise<number>;

  countShiftsConflictingWithAbsenceRanges(
    organizationId: string,
    ranges: { employee_id: string; start_date: string; end_date: string }[]
  ): Promise<number>;

  listOrganizationSwapRequests(
    organizationId: string,
    options?: {
      statuses?: import("@schichtwerk/types").RequestStatus[];
      locationId?: string;
      from?: string;
      to?: string;
    }
  ): Promise<
    import("@schichtwerk/types").SwapRequestWithShiftContext[]
  >;

  listShiftCancelActors(
    organizationId: string,
    shiftIds: string[]
  ): Promise<Map<string, "employee" | "manager">>;

  // —— Manager layout ——
  getManagerProfile(userId: string): Promise<Profile | null>;
}
