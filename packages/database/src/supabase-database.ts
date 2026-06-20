import type {
  AbsenceRequest,
  AbsenceType,
  AreaShiftTemplateWithBreaks,
  AreaQualificationTemplateEntry,
  ConfirmationRequestScope,
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
  Profile,
  ProfileHourlyRate,
  ProfileHourlyRateSummary,
  ProfileCompensationSurcharge,
  EffectiveProfileCompensationSurcharge,
  CompensationSurchargeType,
  CompensationSurchargeUnit,
  ProfileRecurringAvailability,
  ProfileShiftPreference,
  Qualification,
  Role,
  RolePermissionLevel,
  Shift,
  Organization,
} from "@schichtwerk/types";
import type { Session } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Schema } from "./schema";
import type {
  AuthSignUpResult,
  AreaCalendarShiftRow,
  EmployeeShiftRecord,
  InviteUserResult,
  SchichtwerkDatabase,
  ShiftTypeBreakInput,
} from "./interface";
import {
  clampShiftQueryFromDate,
} from "./shift-retention";
import { ABSENCE_PURGE_BATCH_SIZE } from "./absence-retention";
import { normalizeIndustry } from "./industry";
import { normalizePlanningMode } from "./org-planning-mode";
import { validateProfileEmail } from "./profile-contact-validation";
import {
  dayBefore,
  isMutableHourlyRate,
  validateMutableHourlyRateValidFrom,
} from "./profile-hourly-rate-validation";
import {
  applySortOrderBatch,
  validateReorderPermutation,
} from "./reorder-sort-order";
import { buildShiftDeletionSnapshot } from "./shift-deletion-audit";
import {
  isServiceHoursTableUnavailable,
  SERVICE_HOURS_MIGRATION_HINT,
} from "./location-service-hours";
import { validateServiceHoursInput, serviceHoursSameWindow, mapServiceHoursTimeConstraintError } from "./location-service-hours-validation";
import {
  parseAvailabilityTimeRange,
  parseAvailabilityWeekday,
  sortProfileRecurringAvailabilityBySchedule,
  validateNoOverlappingAvailability,
} from "./profile-availability-validation";
import { planAdjacentProfileAvailabilityMerges } from "./profile-availability-merge";
import {
  findProfileShiftPreferenceDuplicate,
  validateNoDuplicateProfileShiftPreference,
} from "./profile-shift-preference-validation";
import {
  sortProfileShiftPreferencesBySchedule,
  validateShiftPreferenceDimensions,
} from "./profile-shift-preference-dimensions";
import {
  normalizeAreaShiftTemplatesWithBreaks,
  normalizeTime,
  replaceAreaShiftTemplateBreaks,
  seedDefaultAreaServiceHours,
  seedDefaultLocationAreas,
  seedDefaultRoles,
} from "./utils";
import { seedOrganizationFromIndustryTemplate } from "./seed-organization-from-template";
import {
  confirmationBatchIsDelta,
  filterSendableProposedShifts,
  parseStoredConfirmationSnapshot,
  resolveConfirmationNotificationChannel,
  resolveConfirmationNotificationTemplateKey,
  shiftToConfirmationSnapshot,
  type ConfirmationSendModalShiftRecord,
  type ProposedShiftForSend,
} from "./shift-confirmation-send";
import {
  buildManagerPendingEscalationBody,
  buildManagerPendingEscalationTitle,
  filterRequestedShiftsDueForPendingTransition,
  type RequestedShiftForPendingJob,
  type ShiftConfirmationPendingJobResult,
} from "./shift-confirmation-pending";
import {
  buildManagerShiftCanceledNotification,
  canCancelShiftByConfirmationStatus,
  isShiftDateInPast,
  SHIFT_CANCEL_NOT_OWNER_ERROR,
  SHIFT_CANCEL_PAST_ERROR,
  shiftCancelBlockedActionError,
} from "./shift-cancellation";
import { assertCanConfirmPastShiftAsManager } from "./shift-past-cleanup";
import { buildSuperadminConfirmationStatusPatch } from "./superadmin-shift-confirmation";
import type { SuperadminShiftRecord } from "./superadmin-shifts";
import {
  enrichShiftRowWithLifecycle,
  lifecycleStatusForConfirmationStatus,
  syncShiftRequestsAfterAssignConfirmationStatus,
  syncShiftRequestsAfterCancellation,
  syncShiftRequestsAfterConfirmationExpired,
  syncShiftRequestsAfterConfirmationResent,
  syncShiftRequestsAfterConfirmationSent,
  syncShiftRequestsAfterEmployeeResponse,
  syncShiftRequestsAfterManagerPastConfirm,
  syncShiftRequestsForSuperadminStatus,
} from "./shift-request-writes";
import { elapsedMinutesBetween } from "./business-minutes";
import { resolveOrganizationTimeZone } from "./organization-timezone";
import {
  assertRespondItemsAllowed,
  buildManagerResponseSummaryNotification,
  decisionToConfirmationStatus,
  isEmployeeRespondableConfirmationStatus,
  validateConfirmationRespondItems,
} from "./shift-confirmation-respond";
import type {
  ConfirmationRespondItem,
  ConfirmationWeekItem,
  ConfirmationWeekResponse,
} from "@schichtwerk/types";
import type { ShiftConfirmationSnapshot } from "./shift-confirmation-snapshot";

const T = Schema.tables;
const PROFILE_SELECT = "*, roles!inner(permission_level, name)";

function throwServiceHoursDbError(message: string): never {
  if (isServiceHoursTableUnavailable(message)) {
    throw new Error(SERVICE_HOURS_MIGRATION_HINT);
  }
  const mapped = mapServiceHoursTimeConstraintError(message);
  if (mapped) throw new Error(mapped);
  throw new Error(message);
}

type ProfileRow = Omit<Profile, "role" | "role_name"> & {
  roles:
    | { permission_level: RolePermissionLevel; name: string }
    | { permission_level: RolePermissionLevel; name: string }[];
};

function mapProfile(row: ProfileRow): Profile {
  const roleRel = Array.isArray(row.roles) ? (row.roles[0] ?? null) : row.roles;
  const { roles: _roles, ...rest } = row;
  return {
    ...rest,
    app_registered_at: rest.app_registered_at ?? null,
    email_fallback_mode: rest.email_fallback_mode ?? false,
    role: roleRel?.permission_level ?? "basic",
    role_name: roleRel?.name ?? "",
  };
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapConfirmationWeekRow(
  row: Record<string, unknown>,
  organizationDisclaimer: string | null
): ConfirmationWeekItem | null {
  const status = row.confirmation_status as import("@schichtwerk/types").ShiftConfirmationStatus;
  if (!isEmployeeRespondableConfirmationStatus(status)) return null;

  const locationRel = row.locations as
    | { name: string }
    | { name: string }[]
    | null;
  const areaRel = row.location_areas as
    | { name: string }
    | { name: string }[]
    | null;
  const templateRel = row.area_shift_templates as
    | { name: string }
    | { name: string }[]
    | null;
  const location = Array.isArray(locationRel) ? locationRel[0] : locationRel;
  const area = Array.isArray(areaRel) ? areaRel[0] : areaRel;
  const template = Array.isArray(templateRel) ? templateRel[0] : templateRel;

  return {
    shiftId: row.id as string,
    status,
    shiftDate: row.shift_date as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    locationName: location?.name ?? "",
    areaName: area?.name ?? "",
    templateName: template?.name ?? null,
    jobName: null,
    disclaimer: organizationDisclaimer,
  };
}

const PROFILE_HOURLY_RATE_SELECT =
  "*, creator:created_by(full_name)";

const PROFILE_COMPENSATION_SURCHARGE_SELECT =
  "*, creator:created_by(full_name), surcharge_type:compensation_surcharge_types(name, trigger, amount, unit)";

type ProfileHourlyRateRow = {
  id: string;
  organization_id: string;
  profile_id: string;
  amount: number | string;
  currency: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  created_by: string | null;
  creator?: { full_name: string } | { full_name: string }[] | null;
};

type ProfileRecurringAvailabilityRow = {
  id: string;
  organization_id: string;
  profile_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  sort_order: number;
  created_at: string;
};

function mapProfileRecurringAvailability(
  row: ProfileRecurringAvailabilityRow
): ProfileRecurringAvailability {
  return {
    id: row.id,
    organization_id: row.organization_id,
    profile_id: row.profile_id,
    weekday: row.weekday,
    start_time: row.start_time,
    end_time: row.end_time,
    sort_order: row.sort_order,
    created_at: row.created_at,
  };
}

type ProfileShiftPreferenceRow = {
  id: string;
  organization_id: string;
  profile_id: string;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  location_id: string | null;
  location_area_id: string | null;
  qualification_id: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
};

function mapProfileShiftPreference(
  row: ProfileShiftPreferenceRow
): ProfileShiftPreference {
  return {
    id: row.id,
    organization_id: row.organization_id,
    profile_id: row.profile_id,
    weekday: row.weekday,
    start_time: row.start_time,
    end_time: row.end_time,
    location_id: row.location_id,
    location_area_id: row.location_area_id,
    qualification_id: row.qualification_id,
    priority: row.priority,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeShiftPreferenceTime(value: string): string {
  return value.trim().slice(0, 5);
}

function validateShiftPreferenceTimes(start_time: string, end_time: string) {
  const start = normalizeShiftPreferenceTime(start_time);
  const end = normalizeShiftPreferenceTime(end_time);
  if (!start || !end || start === end) {
    return { ok: false as const, error: "Ungültiges Zeitfenster" };
  }
  return { ok: true as const, start_time: start, end_time: end };
}

function normalizeShiftPreferenceInsertInput(input: {
  weekday?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  location_id?: string | null;
  location_area_id?: string | null;
  qualification_id?: string | null;
  priority?: number;
}) {
  const dimensions = validateShiftPreferenceDimensions(input);
  if (!dimensions.ok) throw new Error(dimensions.error);

  let weekday: number | null = null;
  let start_time: string | null = null;
  let end_time: string | null = null;

  if (dimensions.hasTime) {
    const weekdayResult = parseAvailabilityWeekday(input.weekday!);
    if (!weekdayResult.ok) throw new Error(weekdayResult.error);
    const times = validateShiftPreferenceTimes(input.start_time!, input.end_time!);
    if (!times.ok) throw new Error(times.error);
    weekday = weekdayResult.weekday;
    start_time = times.start_time;
    end_time = times.end_time;
  }

  return {
    weekday,
    start_time,
    end_time,
    location_id: input.location_id ?? null,
    location_area_id: input.location_area_id ?? null,
    qualification_id: input.qualification_id ?? null,
    priority: input.priority ?? 0,
  };
}

function mapProfileHourlyRate(row: ProfileHourlyRateRow): ProfileHourlyRate {
  const amount =
    typeof row.amount === "string" ? Number.parseFloat(row.amount) : row.amount;
  const creatorRel = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  return {
    id: row.id,
    organization_id: row.organization_id,
    profile_id: row.profile_id,
    amount,
    currency: row.currency,
    valid_from: row.valid_from.slice(0, 10),
    valid_to: row.valid_to ? row.valid_to.slice(0, 10) : null,
    created_at: row.created_at,
    created_by: row.created_by,
    created_by_name: creatorRel?.full_name ?? null,
  };
}

type ProfileCompensationSurchargeRow = {
  id: string;
  organization_id: string;
  profile_id: string;
  surcharge_type_id: string;
  amount: number | string | null;
  unit: CompensationSurchargeType["unit"] | null;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  created_by: string | null;
  creator?: { full_name: string } | { full_name: string }[] | null;
  surcharge_type?:
    | {
        name: string;
        trigger: CompensationSurchargeType["trigger"];
        amount: number | string;
        unit: CompensationSurchargeType["unit"];
      }
    | {
        name: string;
        trigger: CompensationSurchargeType["trigger"];
        amount: number | string;
        unit: CompensationSurchargeType["unit"];
      }[]
    | null;
};

function parseNumericField(value: number | string): number {
  return typeof value === "string" ? Number.parseFloat(value) : value;
}

function mapProfileCompensationSurcharge(
  row: ProfileCompensationSurchargeRow
): ProfileCompensationSurcharge {
  const typeRel = Array.isArray(row.surcharge_type)
    ? row.surcharge_type[0]
    : row.surcharge_type;
  const creatorRel = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  const amount =
    row.amount === null || row.amount === undefined
      ? null
      : parseNumericField(row.amount);
  return {
    id: row.id,
    organization_id: row.organization_id,
    profile_id: row.profile_id,
    surcharge_type_id: row.surcharge_type_id,
    surcharge_type_name: typeRel?.name ?? "",
    trigger: typeRel?.trigger ?? "public_holiday",
    type_default_amount: typeRel ? parseNumericField(typeRel.amount) : 0,
    type_default_unit: typeRel?.unit ?? "eur_per_hour",
    amount,
    unit: row.unit ?? null,
    valid_from: row.valid_from.slice(0, 10),
    valid_to: row.valid_to ? row.valid_to.slice(0, 10) : null,
    created_at: row.created_at,
    created_by: row.created_by,
    created_by_name: creatorRel?.full_name ?? null,
  };
}

function mapEffectiveProfileCompensationSurcharge(
  row: ProfileCompensationSurcharge
): EffectiveProfileCompensationSurcharge {
  return {
    id: row.id,
    surcharge_type_id: row.surcharge_type_id,
    name: row.surcharge_type_name,
    trigger: row.trigger,
    amount: row.amount ?? row.type_default_amount,
    unit: row.unit ?? row.type_default_unit,
  };
}

export class SupabaseSchichtwerkDatabase implements SchichtwerkDatabase {
  constructor(private readonly client: SupabaseClient) {}

  async authGetSession(): Promise<Session | null> {
    const { data } = await this.client.auth.getSession();
    return data.session;
  }

  async authGetUser() {
    const { data } = await this.client.auth.getUser();
    return data.user;
  }

  async authSignInWithPassword(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async authSignUp(
    email: string,
    password: string,
    metadata: { full_name: string }
  ): Promise<{ data: AuthSignUpResult | null; error: string | null }> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: metadata.full_name } },
    });
    if (error) return { data: null, error: error.message };
    if (!data.user) return { data: null, error: "Registrierung fehlgeschlagen" };
    return {
      data: { user: data.user, session: data.session },
      error: null,
    };
  }

  async authSignOut() {
    await this.client.auth.signOut();
  }

  async authResetPasswordForEmail(email: string, redirectTo: string) {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error: error?.message ?? null };
  }

  async authUpdatePassword(password: string) {
    const { error } = await this.client.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }

  async authUpdateEmail(email: string) {
    const { error } = await this.client.auth.updateUser({ email });
    return { error: error?.message ?? null };
  }

  async authAdminUpdateUserEmail(userId: string, email: string) {
    const admin = this.client.auth.admin;
    if (!admin?.updateUserById) {
      return { error: "Admin-Auth nicht verfügbar" };
    }
    const { error } = await admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    return { error: error?.message ?? null };
  }

  async authExchangeCodeForSession(code: string) {
    const { error } = await this.client.auth.exchangeCodeForSession(code);
    return { error: error?.message ?? null };
  }

  async authInviteUserByEmail(
    email: string,
    options: { full_name: string; redirectTo: string }
  ): Promise<{ data: InviteUserResult | null; error: string | null }> {
    const admin = this.client.auth.admin;
    if (!admin?.inviteUserByEmail) {
      return { data: null, error: "Admin-Auth nicht verfügbar" };
    }
    const { data, error } = await admin.inviteUserByEmail(email, {
      data: { full_name: options.full_name },
      redirectTo: options.redirectTo,
    });
    if (error) return { data: null, error: error.message };
    if (!data.user) return { data: null, error: "Einladung fehlgeschlagen" };
    return { data: { user: data.user }, error: null };
  }

  async authAdminCreateUser(
    email: string,
    options: { full_name: string; password?: string }
  ): Promise<{ data: InviteUserResult | null; error: string | null }> {
    const admin = this.client.auth.admin;
    if (!admin?.createUser) {
      return { data: null, error: "Admin-Auth nicht verfügbar" };
    }
    const { data, error } = await admin.createUser({
      email,
      password: options.password ?? crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: options.full_name },
    });
    if (error) return { data: null, error: error.message };
    if (!data.user) return { data: null, error: "Benutzer konnte nicht angelegt werden" };
    return { data: { user: data.user }, error: null };
  }

  async authDeleteUser(userId: string): Promise<void> {
    const admin = this.client.auth.admin;
    if (!admin?.deleteUser) {
      throw new Error("Admin-Auth nicht verfügbar");
    }
    const { error } = await admin.deleteUser(userId);
    if (error) throw new Error(error.message);
  }

  async createOrganization(
    name: string,
    countryCode = "DE",
    options?: {
      planningMode?: import("@schichtwerk/types").PlanningMode;
      industry?: import("@schichtwerk/types").Industry | null;
    }
  ) {
    const code = countryCode.trim().toUpperCase().slice(0, 2) || "DE";
    const row: Record<string, unknown> = { name, country_code: code };
    if (options?.planningMode !== undefined) {
      row.planning_mode = options.planningMode;
    }
    if (options?.industry !== undefined) {
      row.industry = options.industry;
    }
    const { data, error } = await this.client
      .from(T.organizations)
      .insert(row)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Organisation fehlgeschlagen");
    return { id: data.id as string };
  }

  async getOrganization(id: string): Promise<Organization | null> {
    const { data, error } = await this.client
      .from(T.organizations)
      .select(
        "id, name, timezone, country_code, planning_mode, industry, allow_retroactive_compensation_entries, shift_confirmation_enabled, shift_confirmation_disclaimer, created_at"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id as string,
      name: data.name as string,
      timezone: data.timezone as string,
      country_code: data.country_code as string,
      planning_mode: normalizePlanningMode(data.planning_mode),
      industry: normalizeIndustry(data.industry),
      allow_retroactive_compensation_entries:
        (data.allow_retroactive_compensation_entries as boolean | null) ?? true,
      shift_confirmation_enabled:
        (data.shift_confirmation_enabled as boolean | null) ?? false,
      shift_confirmation_disclaimer:
        (data.shift_confirmation_disclaimer as string | null) ?? null,
      created_at: data.created_at as string,
    };
  }

  async deleteOrganization(id: string) {
    const { error } = await this.client.from(T.organizations).delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async getOrganizationName(id: string) {
    const { data } = await this.client
      .from(T.organizations)
      .select("name")
      .eq("id", id)
      .single();
    return (data?.name as string) ?? null;
  }

  async getOrganizationCountryCode(id: string) {
    const { data } = await this.client
      .from(T.organizations)
      .select("country_code")
      .eq("id", id)
      .single();
    return (data?.country_code as string) ?? null;
  }

  async updateOrganizationPlanningMode(
    organizationId: string,
    planningMode: import("@schichtwerk/types").PlanningMode
  ) {
    const { error } = await this.client
      .from(T.organizations)
      .update({ planning_mode: planningMode })
      .eq("id", organizationId);
    if (error) throw new Error(error.message);
  }

  async updateOrganizationAllowRetroactiveCompensationEntries(
    organizationId: string,
    allowed: boolean
  ) {
    const { error } = await this.client
      .from(T.organizations)
      .update({ allow_retroactive_compensation_entries: allowed })
      .eq("id", organizationId);
    if (error) throw new Error(error.message);
  }

  async updateOrganizationShiftConfirmationEnabled(
    organizationId: string,
    enabled: boolean
  ) {
    const { error } = await this.client
      .from(T.organizations)
      .update({ shift_confirmation_enabled: enabled })
      .eq("id", organizationId);
    if (error) throw new Error(error.message);
  }

  async updateOrganizationShiftConfirmationDisclaimer(
    organizationId: string,
    disclaimer: string | null
  ) {
    const { error } = await this.client
      .from(T.organizations)
      .update({ shift_confirmation_disclaimer: disclaimer })
      .eq("id", organizationId);
    if (error) throw new Error(error.message);
  }

  async getOrganizationIdByProfileEmail(email: string) {
    const { data, error } = await this.client
      .from(T.profiles)
      .select("organization_id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.organization_id as string) ?? null;
  }

  async getFirstOrganization() {
    const { data, error } = await this.client
      .from(T.organizations)
      .select("id, name")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { id: data.id as string, name: data.name as string };
  }

  async getCurrentUserProfile() {
    const user = await this.authGetUser();
    if (!user) return null;
    return this.getProfileById(user.id);
  }

  async updateCurrentUserProfileEmail(newEmail: string) {
    const user = await this.authGetUser();
    if (!user) {
      return { ok: false as const, error: "Nicht angemeldet" };
    }

    const profile = await this.getProfileById(user.id);
    if (!profile) {
      return { ok: false as const, error: "Profil nicht gefunden" };
    }

    const parsed = validateProfileEmail(newEmail);
    if (!parsed.ok) return parsed;

    if (parsed.email === profile.email.trim().toLowerCase()) {
      return {
        ok: true as const,
        profile,
        confirmationRequired: false,
      };
    }

    const duplicate = await this.findProfileByEmail(
      profile.organization_id,
      parsed.email
    );
    if (duplicate && duplicate.id !== profile.id) {
      return { ok: false as const, error: "Diese E-Mail ist bereits im Team." };
    }

    const authResult = await this.authUpdateEmail(parsed.email);
    if (authResult.error) {
      return { ok: false as const, error: authResult.error };
    }

    const { error: profileError } = await this.client
      .from(T.profiles)
      .update({ email: parsed.email })
      .eq("id", profile.id)
      .eq("organization_id", profile.organization_id);
    if (profileError) {
      return { ok: false as const, error: profileError.message };
    }

    const updated = await this.getProfileById(profile.id);
    if (!updated) {
      return { ok: false as const, error: "Profil konnte nicht geladen werden" };
    }

    const refreshedUser = await this.authGetUser();
    const confirmationRequired =
      !!refreshedUser?.new_email &&
      refreshedUser.new_email.toLowerCase() === parsed.email;

    return {
      ok: true as const,
      profile: updated,
      confirmationRequired,
    };
  }

  async getProfileById(id: string) {
    const { data, error } = await this.client
      .from(T.profiles)
      .select(PROFILE_SELECT)
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return mapProfile(data as ProfileRow);
  }

  async getProfileRole(id: string) {
    const { data } = await this.client
      .from(T.profiles)
      .select("roles!inner(permission_level)")
      .eq("id", id)
      .single();
    if (!data) return null;
    const roleRel = (data as { roles: { permission_level: RolePermissionLevel } | { permission_level: RolePermissionLevel }[] }).roles;
    const level = Array.isArray(roleRel) ? (roleRel[0] ?? null)?.permission_level : roleRel?.permission_level;
    return level ?? null;
  }

  async getRoleIdByPermissionLevel(
    organizationId: string,
    permissionLevel: RolePermissionLevel
  ) {
    const { data } = await this.client
      .from(T.roles)
      .select("id")
      .eq("organization_id", organizationId)
      .eq("key", permissionLevel)
      .is("archived_at", null)
      .maybeSingle();
    return (data?.id as string) ?? null;
  }

  async getProfileOrganizationId(userId: string) {
    const { data } = await this.client
      .from(T.profiles)
      .select("organization_id")
      .eq("id", userId)
      .single();
    return (data?.organization_id as string) ?? null;
  }

  async insertProfile(row: {
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
  }) {
    let roleId = row.role_id;
    if (!roleId && row.role) {
      roleId = (await this.getRoleIdByPermissionLevel(
        row.organization_id,
        row.role
      )) ?? undefined;
    }
    if (!roleId) {
      throw new Error("Rolle nicht gefunden");
    }
    const sortOrder = await this.getNextProfileSortOrder(row.organization_id);
    const { error } = await this.client.from(T.profiles).insert({
      id: row.id,
      organization_id: row.organization_id,
      role_id: roleId,
      full_name: row.full_name,
      email: row.email,
      mobile_phone: row.mobile_phone ?? null,
      color: row.color ?? null,
      sort_order: sortOrder,
      ...(row.weekly_hours !== undefined ? { weekly_hours: row.weekly_hours } : {}),
      ...(row.is_active !== undefined ? { is_active: row.is_active } : {}),
      ...(row.schedulable !== undefined ? { schedulable: row.schedulable } : {}),
    });
    if (error) throw new Error(error.message);
  }

  async updateOrganizationProfile(
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
  ) {
    const { error } = await this.client
      .from(T.profiles)
      .update({
        full_name: row.full_name,
        is_active: row.is_active,
        schedulable: row.schedulable,
        email: row.email,
        mobile_phone: row.mobile_phone,
        color: row.color,
        ...(row.weekly_hours !== undefined ? { weekly_hours: row.weekly_hours } : {}),
        ...(row.email_fallback_mode !== undefined
          ? { email_fallback_mode: row.email_fallback_mode }
          : {}),
      })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async updateProfileSuperadminSimulationSettings(
    id: string,
    organizationId: string,
    row: {
      is_active: boolean;
      schedulable: boolean;
      app_registered_at: string | null;
      email_fallback_mode: boolean;
    }
  ) {
    const schedulable = row.is_active ? row.schedulable : false;
    const { error } = await this.client
      .from(T.profiles)
      .update({
        is_active: row.is_active,
        schedulable,
        app_registered_at: row.app_registered_at,
        email_fallback_mode: row.email_fallback_mode,
      })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async listAssignedProfileColors(
    organizationId: string,
    excludeProfileId?: string
  ) {
    let query = this.client
      .from(T.profiles)
      .select("color")
      .eq("organization_id", organizationId)
      .not("color", "is", null);
    if (excludeProfileId) {
      query = query.neq("id", excludeProfileId);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const colors = new Set<string>();
    for (const row of data ?? []) {
      const color = row.color as string | null;
      if (color) colors.add(color.toUpperCase());
    }
    return [...colors];
  }

  async listOrganizationProfiles(organizationId: string) {
    const { data, error } = await this.client
      .from(T.profiles)
      .select(PROFILE_SELECT)
      .eq("organization_id", organizationId)
      .order("sort_order")
      .order("full_name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapProfile(row as ProfileRow));
  }

  async getNextProfileSortOrder(organizationId: string) {
    const { data } = await this.client
      .from(T.profiles)
      .select("sort_order")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.sort_order as number) ?? -1) + 1;
  }

  async reorderProfiles(organizationId: string, orderedIds: string[]) {
    const existing = await this.listOrganizationProfiles(organizationId);
    validateReorderPermutation(
      existing.map((entry) => entry.id),
      orderedIds
    );
    await applySortOrderBatch(
      orderedIds.map((id, index) =>
        this.client
          .from(T.profiles)
          .update({ sort_order: index })
          .eq("id", id)
          .eq("organization_id", organizationId)
      )
    );
  }

  async listActiveEmployees(organizationId: string) {
    const { data } = await this.client
      .from(T.profiles)
      .select(PROFILE_SELECT)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("roles.permission_level", "basic")
      .order("sort_order")
      .order("full_name");
    return (data ?? []).map((row) => mapProfile(row as ProfileRow));
  }

  async listPlanningEmployees(organizationId: string) {
    const { data } = await this.client
      .from(T.profiles)
      .select(PROFILE_SELECT)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("schedulable", true)
      .order("sort_order")
      .order("full_name");
    return (data ?? []).map((row) => mapProfile(row as ProfileRow));
  }

  async countActiveEmployees(organizationId: string) {
    const { count } = await this.client
      .from(T.profiles)
      .select("id, roles!inner(permission_level)", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("roles.permission_level", "basic");
    return count ?? 0;
  }

  async findProfileByEmail(organizationId: string, email: string) {
    const { data } = await this.client
      .from(T.profiles)
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .maybeSingle();
    return data ? { id: data.id as string } : null;
  }

  async deactivateEmployee(organizationId: string, employeeId: string) {
    const { error } = await this.client
      .from(T.profiles)
      .update({ is_active: false })
      .eq("id", employeeId)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async listQualifications(organizationId: string) {
    const { data, error } = await this.client
      .from(T.qualifications)
      .select("*")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as Qualification[];
  }

  async getNextQualificationSortOrder(organizationId: string) {
    const { data } = await this.client
      .from(T.qualifications)
      .select("sort_order")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.sort_order as number) ?? -1) + 1;
  }

  async insertQualification(row: {
    organization_id: string;
    name: string;
    sort_order: number;
  }) {
    const { data, error } = await this.client
      .from(T.qualifications)
      .insert({
        organization_id: row.organization_id,
        name: row.name,
        sort_order: row.sort_order,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Speichern fehlgeschlagen");
    return { id: data.id as string };
  }

  async updateQualification(
    id: string,
    organizationId: string,
    row: { name: string }
  ) {
    const { error } = await this.client
      .from(T.qualifications)
      .update({ name: row.name })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("archived_at", null);
    if (error) throw new Error(error.message);
  }

  async listProfileQualifications(organizationId: string, profileId: string) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) return [];

    const { data: links, error: linkError } = await this.client
      .from(T.profileQualifications)
      .select("qualification_id")
      .eq("profile_id", profileId);
    if (linkError) throw new Error(linkError.message);

    const qualificationIds = (links ?? []).map(
      (row) => row.qualification_id as string
    );
    if (!qualificationIds.length) return [];

    const { data, error } = await this.client
      .from(T.qualifications)
      .select("*")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("id", qualificationIds);
    if (error) throw new Error(error.message);

    return ((data ?? []) as Qualification[]).sort(
      (a, b) => a.sort_order - b.sort_order
    );
  }

  async assignProfileQualification(
    organizationId: string,
    profileId: string,
    qualificationId: string
  ) {
    const [profile, qualification] = await Promise.all([
      this.getProfileById(profileId),
      this.client
        .from(T.qualifications)
        .select("id, organization_id, archived_at")
        .eq("id", qualificationId)
        .maybeSingle(),
    ]);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }
    const qual = qualification.data;
    if (
      !qual ||
      qual.organization_id !== organizationId ||
      qual.archived_at != null
    ) {
      throw new Error("Tätigkeit nicht gefunden");
    }

    const { error } = await this.client.from(T.profileQualifications).insert({
      profile_id: profileId,
      qualification_id: qualificationId,
    });
    if (error) throw new Error(error.message);
  }

  async removeProfileQualification(
    organizationId: string,
    profileId: string,
    qualificationId: string
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const { error } = await this.client
      .from(T.profileQualifications)
      .delete()
      .eq("profile_id", profileId)
      .eq("qualification_id", qualificationId);
    if (error) throw new Error(error.message);
  }

  async listProfileRecurringAvailability(
    organizationId: string,
    profileId: string
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) return [];

    const { data, error } = await this.client
      .from(T.profileRecurringAvailability)
      .select("*")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .order("sort_order");
    if (error) throw new Error(error.message);

    return sortProfileRecurringAvailabilityBySchedule(
      (data ?? []).map((row) =>
        mapProfileRecurringAvailability(row as ProfileRecurringAvailabilityRow)
      )
    );
  }

  async listOrganizationRecurringAvailability(organizationId: string) {
    const { data, error } = await this.client
      .from(T.profileRecurringAvailability)
      .select("*")
      .eq("organization_id", organizationId)
      .order("sort_order");
    if (error) throw new Error(error.message);

    return sortProfileRecurringAvailabilityBySchedule(
      (data ?? []).map((row) =>
        mapProfileRecurringAvailability(row as ProfileRecurringAvailabilityRow)
      )
    );
  }

  private async syncProfileRecurringAvailabilitySortOrder(
    organizationId: string,
    profileId: string
  ) {
    const { data, error } = await this.client
      .from(T.profileRecurringAvailability)
      .select("id, weekday, start_time, end_time")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId);
    if (error) throw new Error(error.message);

    const sorted = sortProfileRecurringAvailabilityBySchedule(
      (data ?? []).map((row) => ({
        id: row.id as string,
        weekday: row.weekday as number,
        start_time: row.start_time as string,
        end_time: row.end_time as string,
      }))
    );

    await applySortOrderBatch(
      sorted.map((entry, index) =>
        this.client
          .from(T.profileRecurringAvailability)
          .update({ sort_order: index })
          .eq("id", entry.id)
          .eq("profile_id", profileId)
          .eq("organization_id", organizationId)
      )
    );
  }

  async listEmployeeIdsWithShiftOnDate(organizationId: string, date: string) {
    const { data, error } = await this.client
      .from(T.shifts)
      .select("employee_id")
      .eq("organization_id", organizationId)
      .eq("shift_date", date);
    if (error) throw new Error(error.message);

    const ids = new Set<string>();
    for (const row of data ?? []) {
      if (row.employee_id) ids.add(row.employee_id as string);
    }
    return [...ids];
  }

  async listEmployeeLastShiftDates(organizationId: string) {
    const { data, error } = await this.client
      .from(T.shifts)
      .select("employee_id, shift_date")
      .eq("organization_id", organizationId)
      .not("employee_id", "is", null)
      .order("shift_date", { ascending: false });
    if (error) throw new Error(error.message);

    const lastByEmployee: Record<string, string> = {};
    for (const row of data ?? []) {
      const employeeId = row.employee_id as string;
      if (!employeeId || lastByEmployee[employeeId]) continue;
      lastByEmployee[employeeId] = row.shift_date as string;
    }
    return lastByEmployee;
  }

  async getNextProfileRecurringAvailabilitySortOrder(profileId: string) {
    const { data } = await this.client
      .from(T.profileRecurringAvailability)
      .select("sort_order")
      .eq("profile_id", profileId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.sort_order as number) ?? -1) + 1;
  }

  async reorderProfileRecurringAvailability(
    organizationId: string,
    profileId: string,
    orderedIds: string[]
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const existing = await this.listProfileRecurringAvailability(
      organizationId,
      profileId
    );
    validateReorderPermutation(
      existing.map((entry) => entry.id),
      orderedIds
    );
    await applySortOrderBatch(
      orderedIds.map((id, index) =>
        this.client
          .from(T.profileRecurringAvailability)
          .update({ sort_order: index })
          .eq("id", id)
          .eq("profile_id", profileId)
          .eq("organization_id", organizationId)
      )
    );
  }

  private async resolveAvailabilityTimes(input: {
    start_time: string;
    end_time: string;
  }): Promise<
    | { ok: true; start_time: string; end_time: string }
    | { ok: false; error: string }
  > {
    const parsed = parseAvailabilityTimeRange({
      start_time: input.start_time,
      end_time: input.end_time,
    });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      start_time: parsed.start_time,
      end_time: parsed.end_time,
    };
  }

  async insertProfileRecurringAvailability(
    organizationId: string,
    profileId: string,
    input: {
      weekday: number;
      start_time: string;
      end_time: string;
    }
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const weekdayResult = parseAvailabilityWeekday(input.weekday);
    if (!weekdayResult.ok) throw new Error(weekdayResult.error);

    const times = await this.resolveAvailabilityTimes(input);
    if (!times.ok) throw new Error(times.error);

    const existing = await this.listProfileRecurringAvailability(
      organizationId,
      profileId
    );
    const overlap = validateNoOverlappingAvailability(
      weekdayResult.weekday,
      times.start_time,
      times.end_time,
      existing
    );
    if (!overlap.ok) throw new Error(overlap.error);

    const sortOrder = await this.getNextProfileRecurringAvailabilitySortOrder(
      profileId
    );

    const { data, error } = await this.client
      .from(T.profileRecurringAvailability)
      .insert({
        organization_id: organizationId,
        profile_id: profileId,
        weekday: weekdayResult.weekday,
        start_time: times.start_time,
        end_time: times.end_time,
        sort_order: sortOrder,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Speichern fehlgeschlagen");
    }
    await this.syncProfileRecurringAvailabilitySortOrder(organizationId, profileId);
    await this.mergeAdjacentProfileRecurringAvailability(organizationId, profileId);
    return mapProfileRecurringAvailability(data as ProfileRecurringAvailabilityRow);
  }

  private async mergeAdjacentProfileRecurringAvailability(
    organizationId: string,
    profileId: string
  ): Promise<void> {
    const existing = await this.listProfileRecurringAvailability(
      organizationId,
      profileId
    );
    const mergePlans = planAdjacentProfileAvailabilityMerges(existing);
    if (mergePlans.length === 0) return;

    for (const plan of mergePlans) {
      const { error: updateError } = await this.client
        .from(T.profileRecurringAvailability)
        .update({
          start_time: plan.start_time,
          end_time: plan.end_time,
        })
        .eq("id", plan.keepId)
        .eq("profile_id", profileId)
        .eq("organization_id", organizationId);
      if (updateError) throw new Error(updateError.message);

      for (const deleteId of plan.deleteIds) {
        const { error: deleteError } = await this.client
          .from(T.profileRecurringAvailability)
          .delete()
          .eq("id", deleteId)
          .eq("profile_id", profileId)
          .eq("organization_id", organizationId);
        if (deleteError) throw new Error(deleteError.message);
      }
    }

    await this.syncProfileRecurringAvailabilitySortOrder(organizationId, profileId);
  }

  async updateProfileRecurringAvailability(
    organizationId: string,
    profileId: string,
    availabilityId: string,
    input: {
      weekday: number;
      start_time: string;
      end_time: string;
    }
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const weekdayResult = parseAvailabilityWeekday(input.weekday);
    if (!weekdayResult.ok) throw new Error(weekdayResult.error);

    const times = await this.resolveAvailabilityTimes(input);
    if (!times.ok) throw new Error(times.error);

    const existing = await this.listProfileRecurringAvailability(
      organizationId,
      profileId
    );
    const overlap = validateNoOverlappingAvailability(
      weekdayResult.weekday,
      times.start_time,
      times.end_time,
      existing,
      availabilityId
    );
    if (!overlap.ok) throw new Error(overlap.error);

    const { data, error } = await this.client
      .from(T.profileRecurringAvailability)
      .update({
        weekday: weekdayResult.weekday,
        start_time: times.start_time,
        end_time: times.end_time,
      })
      .eq("id", availabilityId)
      .eq("profile_id", profileId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Speichern fehlgeschlagen");
    await this.syncProfileRecurringAvailabilitySortOrder(organizationId, profileId);
    await this.mergeAdjacentProfileRecurringAvailability(organizationId, profileId);
    return mapProfileRecurringAvailability(data as ProfileRecurringAvailabilityRow);
  }

  async deleteProfileRecurringAvailability(
    organizationId: string,
    profileId: string,
    availabilityId: string
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const { error } = await this.client
      .from(T.profileRecurringAvailability)
      .delete()
      .eq("id", availabilityId)
      .eq("profile_id", profileId)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
    await this.syncProfileRecurringAvailabilitySortOrder(organizationId, profileId);
  }

  async listProfileShiftPreferences(organizationId: string, profileId: string) {
    const { data, error } = await this.client
      .from(T.profileShiftPreferences)
      .select("*")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .order("weekday")
      .order("start_time");
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) =>
      mapProfileShiftPreference(row as ProfileShiftPreferenceRow)
    );
  }

  async listOrganizationShiftPreferences(
    organizationId: string,
    weekday: number
  ) {
    const { data, error } = await this.client
      .from(T.profileShiftPreferences)
      .select("*")
      .eq("organization_id", organizationId)
      .or(`weekday.eq.${weekday},weekday.is.null`)
      .order("profile_id")
      .order("priority", { ascending: false })
      .order("start_time");
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) =>
      mapProfileShiftPreference(row as ProfileShiftPreferenceRow)
    );
  }

  async listAllOrganizationShiftPreferences(organizationId: string) {
    const { data, error } = await this.client
      .from(T.profileShiftPreferences)
      .select("*")
      .eq("organization_id", organizationId)
      .order("profile_id")
      .order("weekday", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) =>
      mapProfileShiftPreference(row as ProfileShiftPreferenceRow)
    );
  }

  async insertProfileShiftPreference(
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
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const normalized = normalizeShiftPreferenceInsertInput(input);

    const existing = await this.listProfileShiftPreferences(organizationId, profileId);
    const duplicate = findProfileShiftPreferenceDuplicate(existing, normalized);
    if (duplicate) {
      return duplicate;
    }

    const { data, error } = await this.client
      .from(T.profileShiftPreferences)
      .insert({
        organization_id: organizationId,
        profile_id: profileId,
        weekday: normalized.weekday,
        start_time: normalized.start_time,
        end_time: normalized.end_time,
        location_id: normalized.location_id,
        location_area_id: normalized.location_area_id,
        qualification_id: normalized.qualification_id,
        priority: normalized.priority,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Speichern fehlgeschlagen");
    }
    return mapProfileShiftPreference(data as ProfileShiftPreferenceRow);
  }

  async updateProfileShiftPreference(
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
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const normalized = normalizeShiftPreferenceInsertInput(input);

    const existing = await this.listProfileShiftPreferences(organizationId, profileId);
    const duplicateCheck = validateNoDuplicateProfileShiftPreference(
      existing,
      normalized,
      preferenceId
    );
    if (!duplicateCheck.ok) throw new Error(duplicateCheck.error);

    const { data, error } = await this.client
      .from(T.profileShiftPreferences)
      .update({
        weekday: normalized.weekday,
        start_time: normalized.start_time,
        end_time: normalized.end_time,
        location_id: normalized.location_id,
        location_area_id: normalized.location_area_id,
        qualification_id: normalized.qualification_id,
        priority: normalized.priority,
        updated_at: new Date().toISOString(),
      })
      .eq("id", preferenceId)
      .eq("profile_id", profileId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Speichern fehlgeschlagen");
    return mapProfileShiftPreference(data as ProfileShiftPreferenceRow);
  }

  async deleteProfileShiftPreference(
    organizationId: string,
    profileId: string,
    preferenceId: string
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const { error } = await this.client
      .from(T.profileShiftPreferences)
      .delete()
      .eq("id", preferenceId)
      .eq("profile_id", profileId)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async getServerDateIso() {
    const { data, error } = await this.client.rpc("current_date_iso");
    if (error) throw new Error(error.message);
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      throw new Error("Referenzdatum konnte nicht ermittelt werden.");
    }
    return data;
  }

  async getProfileHourlyRateById(
    organizationId: string,
    profileId: string,
    rateId: string
  ) {
    const { data, error } = await this.client
      .from(T.profileHourlyRates)
      .select(PROFILE_HOURLY_RATE_SELECT)
      .eq("id", rateId)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return mapProfileHourlyRate(data as ProfileHourlyRateRow);
  }

  private async findPredecessorProfileHourlyRate(
    organizationId: string,
    profileId: string,
    validFrom: string
  ) {
    const { data, error } = await this.client
      .from(T.profileHourlyRates)
      .select("id, valid_from, valid_to")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .eq("valid_to", dayBefore(validFrom))
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as { id: string; valid_from: string; valid_to: string | null } | null;
  }

  private async findSuccessorProfileHourlyRate(
    organizationId: string,
    profileId: string,
    validFrom: string
  ) {
    const { data, error } = await this.client
      .from(T.profileHourlyRates)
      .select("id, valid_from")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .gt("valid_from", validFrom)
      .order("valid_from", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as { id: string; valid_from: string } | null;
  }

  private async rechainProfileHourlyRates(
    organizationId: string,
    profileId: string
  ) {
    const { data, error } = await this.client
      .from(T.profileHourlyRates)
      .select("id, valid_from")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .order("valid_from", { ascending: true });
    if (error) throw new Error(error.message);

    const rates = data ?? [];
    for (let i = 0; i < rates.length; i++) {
      const nextValidTo =
        i < rates.length - 1
          ? dayBefore((rates[i + 1].valid_from as string).slice(0, 10))
          : null;
      const { error: updateError } = await this.client
        .from(T.profileHourlyRates)
        .update({ valid_to: nextValidTo })
        .eq("id", rates[i].id as string)
        .eq("organization_id", organizationId);
      if (updateError) throw new Error(updateError.message);
    }
  }

  private async assertUniqueProfileHourlyRateValidFrom(
    organizationId: string,
    profileId: string,
    validFrom: string,
    excludeRateId?: string
  ) {
    let query = this.client
      .from(T.profileHourlyRates)
      .select("id")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .eq("valid_from", validFrom);
    if (excludeRateId) {
      query = query.neq("id", excludeRateId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      throw new Error("Für dieses Gültig-ab-Datum existiert bereits ein Stundensatz.");
    }
  }

  async listProfileHourlyRates(
    organizationId: string,
    profileId: string,
    limit = 10
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) return [];

    const { data, error } = await this.client
      .from(T.profileHourlyRates)
      .select(PROFILE_HOURLY_RATE_SELECT)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .order("valid_from", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      mapProfileHourlyRate(row as ProfileHourlyRateRow)
    );
  }

  async getProfileHourlyRateForDate(
    organizationId: string,
    profileId: string,
    date: string
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) return null;

    const { data, error } = await this.client
      .from(T.profileHourlyRates)
      .select(PROFILE_HOURLY_RATE_SELECT)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .lte("valid_from", date)
      .or(`valid_to.is.null,valid_to.gte.${date}`)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return mapProfileHourlyRate(data as ProfileHourlyRateRow);
  }

  async listCurrentOrganizationProfileHourlyRates(
    organizationId: string,
    date: string
  ): Promise<ProfileHourlyRateSummary[]> {
    const { data, error } = await this.client
      .from(T.profileHourlyRates)
      .select("profile_id, amount, currency, valid_from")
      .eq("organization_id", organizationId)
      .lte("valid_from", date)
      .or(`valid_to.is.null,valid_to.gte.${date}`)
      .order("valid_from", { ascending: false });
    if (error) throw new Error(error.message);

    const byProfile = new Map<string, ProfileHourlyRateSummary>();
    for (const row of data ?? []) {
      const profileId = row.profile_id as string;
      if (byProfile.has(profileId)) continue;
      const amount =
        typeof row.amount === "string"
          ? Number.parseFloat(row.amount)
          : (row.amount as number);
      byProfile.set(profileId, {
        profile_id: profileId,
        amount,
        currency: row.currency as string,
      });
    }
    return [...byProfile.values()];
  }

  async listAllOrganizationProfileHourlyRates(organizationId: string) {
    const { data, error } = await this.client
      .from(T.profileHourlyRates)
      .select(PROFILE_HOURLY_RATE_SELECT)
      .eq("organization_id", organizationId)
      .order("profile_id")
      .order("valid_from", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      mapProfileHourlyRate(row as ProfileHourlyRateRow)
    );
  }

  async setProfileHourlyRate(
    organizationId: string,
    profileId: string,
    input: {
      amount: number;
      valid_from: string;
      created_by: string;
    }
  ) {
    if (!input.created_by) {
      throw new Error("Erfasser ist erforderlich.");
    }

    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const creator = await this.getProfileById(input.created_by);
    if (!creator || creator.organization_id !== organizationId) {
      throw new Error("Erfasser nicht gefunden");
    }

    await this.assertUniqueProfileHourlyRateValidFrom(
      organizationId,
      profileId,
      input.valid_from
    );

    const { data: existingRows, error: listError } = await this.client
      .from(T.profileHourlyRates)
      .select("id, valid_from")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .order("valid_from", { ascending: true });
    if (listError) throw new Error(listError.message);

    const existing = existingRows ?? [];
    const successor = existing.find(
      (row) =>
        (row.valid_from as string).slice(0, 10) > input.valid_from
    );
    const insertValidTo = successor
      ? dayBefore((successor.valid_from as string).slice(0, 10))
      : null;

    if (insertValidTo === null) {
      const { error: closeError } = await this.client
        .from(T.profileHourlyRates)
        .update({ valid_to: dayBefore(input.valid_from) })
        .eq("organization_id", organizationId)
        .eq("profile_id", profileId)
        .is("valid_to", null);
      if (closeError) throw new Error(closeError.message);
    }

    const { data: inserted, error: insertError } = await this.client
      .from(T.profileHourlyRates)
      .insert({
        organization_id: organizationId,
        profile_id: profileId,
        amount: input.amount,
        currency: "EUR",
        valid_from: input.valid_from,
        valid_to: insertValidTo,
        created_by: input.created_by,
      })
      .select(PROFILE_HOURLY_RATE_SELECT)
      .single();
    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "Stundensatz konnte nicht gespeichert werden");
    }

    await this.rechainProfileHourlyRates(organizationId, profileId);

    const refreshed = await this.getProfileHourlyRateById(
      organizationId,
      profileId,
      inserted.id as string
    );
    if (!refreshed) {
      throw new Error("Stundensatz konnte nicht geladen werden");
    }
    return refreshed;
  }

  async updateProfileHourlyRate(
    organizationId: string,
    profileId: string,
    rateId: string,
    input: {
      amount: number;
      valid_from: string;
    }
  ) {
    const rate = await this.getProfileHourlyRateById(
      organizationId,
      profileId,
      rateId
    );
    if (!rate) {
      throw new Error("Stundensatz nicht gefunden");
    }

    if (input.valid_from !== rate.valid_from) {
      await this.assertUniqueProfileHourlyRateValidFrom(
        organizationId,
        profileId,
        input.valid_from,
        rateId
      );
    }

    const { error: updateError } = await this.client
      .from(T.profileHourlyRates)
      .update({
        amount: input.amount,
        valid_from: input.valid_from,
      })
      .eq("id", rateId)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId);
    if (updateError) {
      throw new Error(
        updateError.message ?? "Stundensatz konnte nicht aktualisiert werden"
      );
    }

    await this.rechainProfileHourlyRates(organizationId, profileId);

    const refreshed = await this.getProfileHourlyRateById(
      organizationId,
      profileId,
      rateId
    );
    if (!refreshed) {
      throw new Error("Stundensatz konnte nicht geladen werden");
    }
    return refreshed;
  }

  async deleteProfileHourlyRate(
    organizationId: string,
    profileId: string,
    rateId: string
  ) {
    const rate = await this.getProfileHourlyRateById(
      organizationId,
      profileId,
      rateId
    );
    if (!rate) {
      throw new Error("Stundensatz nicht gefunden");
    }

    const { error: deleteError } = await this.client
      .from(T.profileHourlyRates)
      .delete()
      .eq("id", rateId)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId);
    if (deleteError) throw new Error(deleteError.message);

    await this.rechainProfileHourlyRates(organizationId, profileId);
  }

  async listCompensationSurchargeTypes(organizationId: string) {
    const { data, error } = await this.client
      .from(T.compensationSurchargeTypes)
      .select("*")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      organization_id: row.organization_id as string,
      name: row.name as string,
      trigger: row.trigger as CompensationSurchargeType["trigger"],
      amount: parseNumericField(row.amount as number | string),
      unit: row.unit as CompensationSurchargeType["unit"],
      sort_order: row.sort_order as number,
      archived_at: (row.archived_at as string | null) ?? null,
    }));
  }

  async getNextCompensationSurchargeTypeSortOrder(organizationId: string) {
    const { data } = await this.client
      .from(T.compensationSurchargeTypes)
      .select("sort_order")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? (data.sort_order as number) + 1 : 0;
  }

  async insertCompensationSurchargeType(row: {
    organization_id: string;
    name: string;
    trigger: CompensationSurchargeType["trigger"];
    amount: number;
    unit: CompensationSurchargeType["unit"];
    sort_order: number;
  }) {
    const { data, error } = await this.client
      .from(T.compensationSurchargeTypes)
      .insert({
        organization_id: row.organization_id,
        name: row.name,
        trigger: row.trigger,
        amount: row.amount,
        unit: row.unit,
        sort_order: row.sort_order,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Speichern fehlgeschlagen");
    }
    return { id: data.id as string };
  }

  async updateCompensationSurchargeType(
    id: string,
    organizationId: string,
    row: {
      name: string;
      trigger: CompensationSurchargeType["trigger"];
      amount: number;
      unit: CompensationSurchargeType["unit"];
    }
  ) {
    const { error } = await this.client
      .from(T.compensationSurchargeTypes)
      .update({
        name: row.name,
        trigger: row.trigger,
        amount: row.amount,
        unit: row.unit,
      })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async archiveCompensationSurchargeType(id: string, organizationId: string) {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(T.compensationSurchargeTypes)
      .update({ archived_at: now })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async reorderCompensationSurchargeTypes(
    organizationId: string,
    orderedIds: string[]
  ) {
    const existing = await this.listCompensationSurchargeTypes(organizationId);
    validateReorderPermutation(
      existing.map((entry) => entry.id),
      orderedIds
    );
    await applySortOrderBatch(
      orderedIds.map((id, index) =>
        this.client
          .from(T.compensationSurchargeTypes)
          .update({ sort_order: index })
          .eq("id", id)
          .eq("organization_id", organizationId)
          .is("archived_at", null)
      )
    );
  }

  async getProfileCompensationSurchargeById(
    organizationId: string,
    profileId: string,
    entryId: string
  ) {
    const { data, error } = await this.client
      .from(T.profileCompensationSurcharges)
      .select(PROFILE_COMPENSATION_SURCHARGE_SELECT)
      .eq("id", entryId)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return mapProfileCompensationSurcharge(
      data as ProfileCompensationSurchargeRow
    );
  }

  private async findPredecessorProfileCompensationSurcharge(
    organizationId: string,
    profileId: string,
    surchargeTypeId: string,
    validFrom: string
  ) {
    const { data, error } = await this.client
      .from(T.profileCompensationSurcharges)
      .select("id, valid_from, valid_to")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .eq("surcharge_type_id", surchargeTypeId)
      .eq("valid_to", dayBefore(validFrom))
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as { id: string; valid_from: string; valid_to: string | null } | null;
  }

  private async findSuccessorProfileCompensationSurcharge(
    organizationId: string,
    profileId: string,
    surchargeTypeId: string,
    validFrom: string
  ) {
    const { data, error } = await this.client
      .from(T.profileCompensationSurcharges)
      .select("id, valid_from")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .eq("surcharge_type_id", surchargeTypeId)
      .gt("valid_from", validFrom)
      .order("valid_from", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as { id: string; valid_from: string } | null;
  }

  async listProfileCompensationSurcharges(
    organizationId: string,
    profileId: string,
    limit = 20
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) return [];

    const { data, error } = await this.client
      .from(T.profileCompensationSurcharges)
      .select(PROFILE_COMPENSATION_SURCHARGE_SELECT)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .order("valid_from", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      mapProfileCompensationSurcharge(row as ProfileCompensationSurchargeRow)
    );
  }

  async listAllOrganizationProfileCompensationSurcharges(organizationId: string) {
    const { data, error } = await this.client
      .from(T.profileCompensationSurcharges)
      .select(PROFILE_COMPENSATION_SURCHARGE_SELECT)
      .eq("organization_id", organizationId)
      .order("profile_id")
      .order("valid_from", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      mapProfileCompensationSurcharge(row as ProfileCompensationSurchargeRow)
    );
  }

  async listEffectiveProfileCompensationSurchargesForDate(
    organizationId: string,
    profileId: string,
    date: string
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) return [];

    const { data, error } = await this.client
      .from(T.profileCompensationSurcharges)
      .select(PROFILE_COMPENSATION_SURCHARGE_SELECT)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .lte("valid_from", date)
      .or(`valid_to.is.null,valid_to.gte.${date}`)
      .order("valid_from", { ascending: false });
    if (error) throw new Error(error.message);

    const byType = new Map<string, EffectiveProfileCompensationSurcharge>();
    for (const row of data ?? []) {
      const mapped = mapProfileCompensationSurcharge(
        row as ProfileCompensationSurchargeRow
      );
      if (byType.has(mapped.surcharge_type_id)) continue;
      byType.set(
        mapped.surcharge_type_id,
        mapEffectiveProfileCompensationSurcharge(mapped)
      );
    }
    return [...byType.values()];
  }

  async setProfileCompensationSurcharge(
    organizationId: string,
    profileId: string,
    input: {
      surcharge_type_id: string;
      amount: number | null;
      unit: CompensationSurchargeUnit | null;
      valid_from: string;
      created_by: string;
    }
  ) {
    if (!input.created_by) {
      throw new Error("Erfasser ist erforderlich.");
    }

    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const creator = await this.getProfileById(input.created_by);
    if (!creator || creator.organization_id !== organizationId) {
      throw new Error("Erfasser nicht gefunden");
    }

    const { data: surchargeType, error: typeError } = await this.client
      .from(T.compensationSurchargeTypes)
      .select("id")
      .eq("id", input.surcharge_type_id)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .maybeSingle();
    if (typeError) throw new Error(typeError.message);
    if (!surchargeType) {
      throw new Error("Sonderzuschlag nicht gefunden");
    }

    const { data: openEntry, error: openError } = await this.client
      .from(T.profileCompensationSurcharges)
      .select("id, valid_from")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .eq("surcharge_type_id", input.surcharge_type_id)
      .is("valid_to", null)
      .maybeSingle();
    if (openError) throw new Error(openError.message);

    if (
      openEntry &&
      input.valid_from <= (openEntry.valid_from as string).slice(0, 10)
    ) {
      throw new Error("Das Gültig-ab-Datum muss nach dem aktuellen Eintrag liegen.");
    }

    if (openEntry) {
      const { error: closeError } = await this.client
        .from(T.profileCompensationSurcharges)
        .update({ valid_to: dayBefore(input.valid_from) })
        .eq("id", openEntry.id as string)
        .eq("organization_id", organizationId);
      if (closeError) throw new Error(closeError.message);
    }

    const { data: inserted, error: insertError } = await this.client
      .from(T.profileCompensationSurcharges)
      .insert({
        organization_id: organizationId,
        profile_id: profileId,
        surcharge_type_id: input.surcharge_type_id,
        amount: input.amount,
        unit: input.unit,
        valid_from: input.valid_from,
        valid_to: null,
        created_by: input.created_by,
      })
      .select(PROFILE_COMPENSATION_SURCHARGE_SELECT)
      .single();
    if (insertError || !inserted) {
      throw new Error(
        insertError?.message ?? "Sonderzuschlag konnte nicht gespeichert werden"
      );
    }
    return mapProfileCompensationSurcharge(
      inserted as ProfileCompensationSurchargeRow
    );
  }

  async updateProfileCompensationSurcharge(
    organizationId: string,
    profileId: string,
    entryId: string,
    input: {
      amount: number | null;
      unit: CompensationSurchargeUnit | null;
      valid_from: string;
    },
    referenceDate: string
  ) {
    const entry = await this.getProfileCompensationSurchargeById(
      organizationId,
      profileId,
      entryId
    );
    if (!entry) {
      throw new Error("Sonderzuschlag nicht gefunden");
    }
    if (!isMutableHourlyRate(entry.valid_from, referenceDate)) {
      throw new Error(
        "Nur Einträge mit Gültig-ab ab heute können geändert oder gelöscht werden."
      );
    }

    const validFromCheck = validateMutableHourlyRateValidFrom(
      input.valid_from,
      referenceDate
    );
    if (!validFromCheck.ok) throw new Error(validFromCheck.error);

    const successor = await this.findSuccessorProfileCompensationSurcharge(
      organizationId,
      profileId,
      entry.surcharge_type_id,
      entry.valid_from
    );
    if (successor && input.valid_from >= successor.valid_from.slice(0, 10)) {
      throw new Error("Das Gültig-ab-Datum muss vor dem nächsten Eintrag liegen.");
    }

    if (input.valid_from !== entry.valid_from) {
      const predecessor = await this.findPredecessorProfileCompensationSurcharge(
        organizationId,
        profileId,
        entry.surcharge_type_id,
        entry.valid_from
      );
      if (predecessor) {
        const { error: predError } = await this.client
          .from(T.profileCompensationSurcharges)
          .update({ valid_to: dayBefore(input.valid_from) })
          .eq("id", predecessor.id)
          .eq("organization_id", organizationId);
        if (predError) throw new Error(predError.message);
      }
    }

    const { data: updated, error: updateError } = await this.client
      .from(T.profileCompensationSurcharges)
      .update({
        amount: input.amount,
        unit: input.unit,
        valid_from: input.valid_from,
      })
      .eq("id", entryId)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .select(PROFILE_COMPENSATION_SURCHARGE_SELECT)
      .single();
    if (updateError || !updated) {
      throw new Error(
        updateError?.message ?? "Sonderzuschlag konnte nicht aktualisiert werden"
      );
    }
    return mapProfileCompensationSurcharge(
      updated as ProfileCompensationSurchargeRow
    );
  }

  async deleteProfileCompensationSurcharge(
    organizationId: string,
    profileId: string,
    entryId: string,
    referenceDate: string
  ) {
    const entry = await this.getProfileCompensationSurchargeById(
      organizationId,
      profileId,
      entryId
    );
    if (!entry) {
      throw new Error("Sonderzuschlag nicht gefunden");
    }
    if (!isMutableHourlyRate(entry.valid_from, referenceDate)) {
      throw new Error(
        "Nur Einträge mit Gültig-ab ab heute können geändert oder gelöscht werden."
      );
    }

    const predecessor = await this.findPredecessorProfileCompensationSurcharge(
      organizationId,
      profileId,
      entry.surcharge_type_id,
      entry.valid_from
    );
    const successor = await this.findSuccessorProfileCompensationSurcharge(
      organizationId,
      profileId,
      entry.surcharge_type_id,
      entry.valid_from
    );

    const { error: deleteError } = await this.client
      .from(T.profileCompensationSurcharges)
      .delete()
      .eq("id", entryId)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId);
    if (deleteError) throw new Error(deleteError.message);

    if (predecessor) {
      const nextValidTo = successor
        ? dayBefore(successor.valid_from.slice(0, 10))
        : null;
      const { error: predError } = await this.client
        .from(T.profileCompensationSurcharges)
        .update({ valid_to: nextValidTo })
        .eq("id", predecessor.id)
        .eq("organization_id", organizationId);
      if (predError) throw new Error(predError.message);
    }
  }

  async countUpcomingShiftsForQualificationProfiles(
    organizationId: string,
    qualificationId: string,
    fromDate: string
  ) {
    const { data: profileLinks, error: linkError } = await this.client
      .from(T.profileQualifications)
      .select("profile_id")
      .eq("qualification_id", qualificationId);
    if (linkError) throw new Error(linkError.message);

    const profileIds = (profileLinks ?? []).map((row) => row.profile_id as string);
    if (!profileIds.length) return 0;

    const { count, error } = await this.client
      .from(T.shifts)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("employee_id", profileIds)
      .gte("shift_date", fromDate);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async archiveQualification(id: string, organizationId: string) {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(T.qualifications)
      .update({ archived_at: now })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async reorderQualifications(organizationId: string, orderedIds: string[]) {
    const existing = await this.listQualifications(organizationId);
    validateReorderPermutation(
      existing.map((entry) => entry.id),
      orderedIds
    );
    await applySortOrderBatch(
      orderedIds.map((id, index) =>
        this.client
          .from(T.qualifications)
          .update({ sort_order: index })
          .eq("id", id)
          .eq("organization_id", organizationId)
          .is("archived_at", null)
      )
    );
  }

  async listRoles(organizationId: string) {
    const { data, error } = await this.client
      .from(T.roles)
      .select("*")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as Role[];
  }

  async seedDefaultRoles(organizationId: string) {
    await seedDefaultRoles(this.client, organizationId);
  }

  async seedOrganizationFromIndustryTemplate(
    organizationId: string,
    orgName: string,
    industry: import("@schichtwerk/types").Industry
  ) {
    await seedOrganizationFromIndustryTemplate(
      this.client,
      organizationId,
      orgName,
      industry
    );
  }

  async getNextRoleSortOrder(organizationId: string) {
    const { data } = await this.client
      .from(T.roles)
      .select("sort_order")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.sort_order as number) ?? -1) + 1;
  }

  async insertRole(row: {
    organization_id: string;
    key: string;
    name: string;
    permission_level: RolePermissionLevel;
    is_system?: boolean;
    sort_order: number;
  }) {
    const { data, error } = await this.client
      .from(T.roles)
      .insert({
        organization_id: row.organization_id,
        key: row.key,
        name: row.name,
        permission_level: row.permission_level,
        is_system: row.is_system ?? false,
        sort_order: row.sort_order,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Speichern fehlgeschlagen");
    return { id: data.id as string };
  }

  async updateRole(
    id: string,
    organizationId: string,
    row: { name: string; permission_level: RolePermissionLevel }
  ) {
    const { error } = await this.client
      .from(T.roles)
      .update({
        name: row.name,
        permission_level: row.permission_level,
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("archived_at", null);
    if (error) throw new Error(error.message);
  }

  async archiveRole(id: string, organizationId: string) {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(T.roles)
      .update({ archived_at: now })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("is_system", false);
    if (error) throw new Error(error.message);
  }

  async countProfilesUsingRole(roleId: string, organizationId: string) {
    const { count } = await this.client
      .from(T.profiles)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("role_id", roleId)
      .eq("is_active", true);
    return count ?? 0;
  }

  async reorderRoles(organizationId: string, orderedIds: string[]) {
    const existing = await this.listRoles(organizationId);
    validateReorderPermutation(
      existing.map((entry) => entry.id),
      orderedIds
    );
    await applySortOrderBatch(
      orderedIds.map((id, index) =>
        this.client
          .from(T.roles)
          .update({ sort_order: index })
          .eq("id", id)
          .eq("organization_id", organizationId)
          .is("archived_at", null)
      )
    );
  }

  async listLocations(organizationId: string) {
    const { data, error } = await this.client
      .from(T.locations)
      .select("*")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as Location[];
  }

  async listLocationsForAreaCalendar(
    organizationId: string,
    from: string,
    to: string
  ) {
    const active = await this.listLocations(organizationId);
    const known = new Set(active.map((l) => l.id));

    const { data: shiftRows, error } = await this.client
      .from(T.shifts)
      .select("location_id")
      .eq("organization_id", organizationId)
      .gte("shift_date", from)
      .lte("shift_date", to)
      .not("location_id", "is", null);
    if (error) throw new Error(error.message);

    const extraIds = [
      ...new Set(
        (shiftRows ?? [])
          .map((r) => r.location_id as string)
          .filter((id) => id && !known.has(id))
      ),
    ];
    if (!extraIds.length) return active;

    const { data: historical, error: histErr } = await this.client
      .from(T.locations)
      .select("*")
      .in("id", extraIds)
      .order("sort_order");
    if (histErr) throw new Error(histErr.message);

    return [...active, ...((historical ?? []) as Location[])].sort(
      (a, b) => a.sort_order - b.sort_order
    );
  }

  async getNextLocationSortOrder(organizationId: string) {
    const { data } = await this.client
      .from(T.locations)
      .select("sort_order")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.sort_order as number) ?? -1) + 1;
  }

  async insertLocation(row: {
    organization_id: string;
    name: string;
    sort_order: number;
  }) {
    const { data, error } = await this.client
      .from(T.locations)
      .insert({
        organization_id: row.organization_id,
        name: row.name,
        sort_order: row.sort_order,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Speichern fehlgeschlagen");
    const locationId = data.id as string;
    await seedDefaultLocationAreas(this.client, locationId);
    return { id: locationId };
  }

  async listLocationAreas(locationId: string) {
    const { data, error } = await this.client
      .from(T.locationAreas)
      .select("*")
      .eq("location_id", locationId)
      .is("archived_at", null)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as LocationArea[];
  }

  async listLocationAreasForAreaCalendar(
    locationId: string,
    from: string,
    to: string
  ) {
    const active = await this.listLocationAreas(locationId);
    const known = new Set(active.map((a) => a.id));

    const { data: shiftRows, error } = await this.client
      .from(T.shifts)
      .select("location_area_id")
      .eq("location_id", locationId)
      .gte("shift_date", from)
      .lte("shift_date", to)
      .not("location_area_id", "is", null);
    if (error) throw new Error(error.message);

    const extraIds = [
      ...new Set(
        (shiftRows ?? [])
          .map((r) => r.location_area_id as string)
          .filter((id) => id && !known.has(id))
      ),
    ];
    if (!extraIds.length) return active;

    const { data: historical, error: histErr } = await this.client
      .from(T.locationAreas)
      .select("*")
      .in("id", extraIds)
      .order("sort_order");
    if (histErr) throw new Error(histErr.message);

    return [...active, ...((historical ?? []) as LocationArea[])].sort(
      (a, b) => a.sort_order - b.sort_order
    );
  }

  async getNextLocationAreaSortOrder(locationId: string) {
    const { data } = await this.client
      .from(T.locationAreas)
      .select("sort_order")
      .eq("location_id", locationId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.sort_order as number) ?? -1) + 1;
  }

  async insertLocationArea(row: {
    location_id: string;
    name: string;
    sort_order: number;
    planning_mode?: import("@schichtwerk/types").AreaPlanningMode;
  }) {
    const { data, error } = await this.client
      .from(T.locationAreas)
      .insert({
        location_id: row.location_id,
        name: row.name,
        sort_order: row.sort_order,
        planning_mode: row.planning_mode ?? "simple",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Speichern fehlgeschlagen");
    const areaId = data.id as string;
    await seedDefaultAreaServiceHours(this.client, areaId);
    return { id: areaId };
  }

  async updateLocationArea(
    id: string,
    locationId: string,
    row: {
      name: string;
      planning_mode?: import("@schichtwerk/types").AreaPlanningMode;
    }
  ) {
    const payload: { name: string; planning_mode?: string } = {
      name: row.name,
    };
    if (row.planning_mode !== undefined) {
      payload.planning_mode = row.planning_mode;
    }
    const { error } = await this.client
      .from(T.locationAreas)
      .update(payload)
      .eq("id", id)
      .eq("location_id", locationId)
      .is("archived_at", null);
    if (error) throw new Error(error.message);
  }

  async reorderLocationAreas(locationId: string, orderedIds: string[]) {
    const existing = await this.listLocationAreas(locationId);
    validateReorderPermutation(
      existing.map((entry) => entry.id),
      orderedIds
    );
    await applySortOrderBatch(
      orderedIds.map((id, index) =>
        this.client
          .from(T.locationAreas)
          .update({ sort_order: index })
          .eq("id", id)
          .eq("location_id", locationId)
          .is("archived_at", null)
      )
    );
  }

  async archiveLocationArea(id: string, locationId: string) {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(T.locationAreas)
      .update({ archived_at: now })
      .eq("id", id)
      .eq("location_id", locationId);
    if (error) throw new Error(error.message);
  }

  async reorderLocations(organizationId: string, orderedIds: string[]) {
    const existing = await this.listLocations(organizationId);
    validateReorderPermutation(
      existing.map((entry) => entry.id),
      orderedIds
    );
    await applySortOrderBatch(
      orderedIds.map((id, index) =>
        this.client
          .from(T.locations)
          .update({ sort_order: index })
          .eq("id", id)
          .eq("organization_id", organizationId)
          .is("archived_at", null)
      )
    );
  }

  async archiveLocation(id: string, organizationId: string) {
    const now = new Date().toISOString();
    const { error: areaError } = await this.client
      .from(T.locationAreas)
      .update({ archived_at: now })
      .eq("location_id", id);
    if (areaError) throw new Error(areaError.message);

    const { error } = await this.client
      .from(T.locations)
      .update({ archived_at: now })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async listLocationAreaStaffing(locationId: string) {
    const areas = await this.listLocationAreas(locationId);
    if (!areas.length) return [];
    const areaIds = areas.map((a) => a.id);
    const { data, error } = await this.client
      .from(T.locationAreaStaffing)
      .select(
        "id, location_area_id, service_hour_id, qualification_id, required_count"
      )
      .in("location_area_id", areaIds);
    if (error) throw new Error(error.message);
    return (data ?? []) as LocationAreaStaffing[];
  }

  async listLocationAreaStaffingForArea(
    locationAreaId: string,
    locationId: string
  ) {
    const areas = await this.listLocationAreas(locationId);
    if (!areas.some((a) => a.id === locationAreaId)) return [];
    const { data, error } = await this.client
      .from(T.locationAreaStaffing)
      .select(
        "id, location_area_id, service_hour_id, qualification_id, required_count"
      )
      .eq("location_area_id", locationAreaId);
    if (error) throw new Error(error.message);
    return (data ?? []) as LocationAreaStaffing[];
  }

  async replaceLocationAreaStaffing(
    locationAreaId: string,
    locationId: string,
    rules: {
      service_hour_id: string;
      qualification_id: string;
      required_count: number;
    }[]
  ) {
    const areas = await this.listLocationAreas(locationId);
    if (!areas.some((a) => a.id === locationAreaId)) {
      throw new Error("Bereich nicht gefunden");
    }

    const { error: delError } = await this.client
      .from(T.locationAreaStaffing)
      .delete()
      .eq("location_area_id", locationAreaId);
    if (delError) throw new Error(delError.message);

    const toInsert = rules.filter((r) => r.required_count > 0);
    if (!toInsert.length) return;

    const { error: insError } = await this.client.from(T.locationAreaStaffing).insert(
      toInsert.map((r) => ({
        location_area_id: locationAreaId,
        service_hour_id: r.service_hour_id,
        qualification_id: r.qualification_id,
        required_count: r.required_count,
      }))
    );
    if (insError) throw new Error(insError.message);
  }

  async saveLocationAreaStaffingForServiceHour(
    serviceHourId: string,
    locationId: string,
    rules: {
      qualification_id: string;
      required_count: number;
    }[]
  ) {
    const hours = await this.listLocationAreaServiceHours(locationId);
    if (!hours.some((hour) => hour.id === serviceHourId)) {
      throw new Error("Servicezeit nicht gefunden");
    }

    const toInsert = rules.filter((r) => r.required_count > 0);
    const { error } = await this.client.rpc(
      "replace_location_area_staffing_for_service_hour",
      {
        p_service_hour_id: serviceHourId,
        p_rules: toInsert,
      }
    );
    if (error) throw new Error(error.message);
  }

  async removeLocationAreaStaffingForServiceHour(
    serviceHourId: string,
    locationId: string
  ) {
    const hours = await this.listLocationAreaServiceHours(locationId);
    if (!hours.some((hour) => hour.id === serviceHourId)) {
      throw new Error("Servicezeit nicht gefunden");
    }

    const { error } = await this.client
      .from(T.locationAreaStaffing)
      .delete()
      .eq("service_hour_id", serviceHourId);
    if (error) throw new Error(error.message);
  }

  private async assertLocationAreaInLocation(
    locationAreaId: string,
    locationId: string
  ) {
    const areas = await this.listLocationAreas(locationId);
    if (!areas.some((area) => area.id === locationAreaId)) {
      throw new Error("Bereich nicht gefunden");
    }
  }

  async listAreaShiftTemplatesWithBreaksForArea(
    locationAreaId: string,
    locationId: string
  ): Promise<AreaShiftTemplateWithBreaks[]> {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);
    const { data, error } = await this.client
      .from(T.areaShiftTemplates)
      .select(`*, ${T.areaShiftTemplateBreaks}(*)`)
      .eq("location_area_id", locationAreaId)
      .is("archived_at", null)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return normalizeAreaShiftTemplatesWithBreaks(data ?? []);
  }

  async listAreaShiftTemplatesWithBreaksForLocation(locationId: string) {
    const areas = await this.listLocationAreas(locationId);
    if (!areas.length) return [];
    const areaIds = areas.map((area) => area.id);
    const { data, error } = await this.client
      .from(T.areaShiftTemplates)
      .select(`*, ${T.areaShiftTemplateBreaks}(*)`)
      .in("location_area_id", areaIds)
      .is("archived_at", null)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return normalizeAreaShiftTemplatesWithBreaks(data ?? []);
  }

  async getNextAreaShiftTemplateSortOrder(
    locationAreaId: string,
    locationId: string
  ) {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);
    const { data } = await this.client
      .from(T.areaShiftTemplates)
      .select("sort_order")
      .eq("location_area_id", locationAreaId)
      .is("archived_at", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.sort_order as number) ?? -1) + 1;
  }

  async insertAreaShiftTemplate(row: {
    location_area_id: string;
    name: string;
    start_time: string;
    end_time: string;
    color: string;
    sort_order: number;
  }) {
    const { data, error } = await this.client
      .from(T.areaShiftTemplates)
      .insert({
        location_area_id: row.location_area_id,
        name: row.name,
        start_time: normalizeTime(row.start_time),
        end_time: normalizeTime(row.end_time),
        color: row.color,
        sort_order: row.sort_order,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Speichern fehlgeschlagen");
    return { id: data.id as string };
  }

  async updateAreaShiftTemplate(
    id: string,
    locationAreaId: string,
    locationId: string,
    row: { name: string; start_time: string; end_time: string; color?: string }
  ) {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);
    const { error } = await this.client
      .from(T.areaShiftTemplates)
      .update({
        name: row.name,
        start_time: normalizeTime(row.start_time),
        end_time: normalizeTime(row.end_time),
        ...(row.color !== undefined ? { color: row.color } : {}),
      })
      .eq("id", id)
      .eq("location_area_id", locationAreaId)
      .is("archived_at", null);
    if (error) throw new Error(error.message);
  }

  async replaceAreaShiftTemplateBreaks(
    templateId: string,
    breaks: ShiftTypeBreakInput[]
  ) {
    await replaceAreaShiftTemplateBreaks(this.client, templateId, breaks);
  }

  async archiveAreaShiftTemplate(
    id: string,
    locationAreaId: string,
    locationId: string
  ) {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);
    const { error } = await this.client
      .from(T.areaShiftTemplates)
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("location_area_id", locationAreaId)
      .is("archived_at", null);
    if (error) throw new Error(error.message);
  }

  async clearAreaShiftTemplatesForArea(
    locationAreaId: string,
    locationId: string
  ) {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);
    const { error } = await this.client
      .from(T.areaShiftTemplates)
      .delete()
      .eq("location_area_id", locationAreaId);
    if (error) throw new Error(error.message);
  }

  async reorderAreaShiftTemplates(
    locationAreaId: string,
    locationId: string,
    orderedIds: string[]
  ) {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);
    const { data, error } = await this.client
      .from(T.areaShiftTemplates)
      .select("id")
      .eq("location_area_id", locationAreaId)
      .is("archived_at", null);
    if (error) throw new Error(error.message);
    validateReorderPermutation(
      (data ?? []).map((row) => row.id as string),
      orderedIds
    );
    await applySortOrderBatch(
      orderedIds.map((id, index) =>
        this.client
          .from(T.areaShiftTemplates)
          .update({ sort_order: index })
          .eq("id", id)
          .eq("location_area_id", locationAreaId)
          .is("archived_at", null)
      )
    );
  }

  async listAreaQualificationTemplatesForArea(
    locationAreaId: string,
    locationId: string
  ): Promise<AreaQualificationTemplateEntry[]> {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);

    const { data: links, error: linkError } = await this.client
      .from(T.areaQualificationTemplates)
      .select("id, location_area_id, qualification_id, sort_order")
      .eq("location_area_id", locationAreaId)
      .order("sort_order");
    if (linkError) throw new Error(linkError.message);

    const rows = links ?? [];
    if (!rows.length) return [];

    const qualificationIds = rows.map((row) => row.qualification_id as string);
    const { data: qualifications, error: qualError } = await this.client
      .from(T.qualifications)
      .select("*")
      .in("id", qualificationIds)
      .is("archived_at", null);
    if (qualError) throw new Error(qualError.message);

    const qualificationById = new Map(
      ((qualifications ?? []) as Qualification[]).map((qualification) => [
        qualification.id,
        qualification,
      ])
    );

    return rows
      .map((row) => {
        const qualification = qualificationById.get(row.qualification_id as string);
        if (!qualification) return null;
        return {
          id: row.id as string,
          location_area_id: row.location_area_id as string,
          qualification_id: row.qualification_id as string,
          sort_order: row.sort_order as number,
          qualification,
        };
      })
      .filter((entry): entry is AreaQualificationTemplateEntry => entry != null);
  }

  async listAreaQualificationTemplatesForLocation(locationId: string) {
    const areas = await this.listLocationAreas(locationId);
    if (!areas.length) return [];

    const areaIds = areas.map((area) => area.id);
    const { data: links, error: linkError } = await this.client
      .from(T.areaQualificationTemplates)
      .select("id, location_area_id, qualification_id, sort_order")
      .in("location_area_id", areaIds)
      .order("sort_order");
    if (linkError) throw new Error(linkError.message);

    const rows = links ?? [];
    if (!rows.length) return [];

    const qualificationIds = [...new Set(rows.map((row) => row.qualification_id as string))];
    const { data: qualifications, error: qualError } = await this.client
      .from(T.qualifications)
      .select("*")
      .in("id", qualificationIds)
      .is("archived_at", null);
    if (qualError) throw new Error(qualError.message);

    const qualificationById = new Map(
      ((qualifications ?? []) as Qualification[]).map((qualification) => [
        qualification.id,
        qualification,
      ])
    );

    return rows
      .map((row) => {
        const qualification = qualificationById.get(row.qualification_id as string);
        if (!qualification) return null;
        return {
          id: row.id as string,
          location_area_id: row.location_area_id as string,
          qualification_id: row.qualification_id as string,
          sort_order: row.sort_order as number,
          qualification,
        };
      })
      .filter((entry): entry is AreaQualificationTemplateEntry => entry != null);
  }

  async getNextAreaQualificationTemplateSortOrder(
    locationAreaId: string,
    locationId: string
  ) {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);
    const { data } = await this.client
      .from(T.areaQualificationTemplates)
      .select("sort_order")
      .eq("location_area_id", locationAreaId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.sort_order != null ? (data.sort_order as number) + 1 : 0;
  }

  async assignAreaQualificationTemplate(
    organizationId: string,
    locationAreaId: string,
    locationId: string,
    qualificationId: string
  ) {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);

    const { data: qualification, error: qualError } = await this.client
      .from(T.qualifications)
      .select("id, organization_id, archived_at")
      .eq("id", qualificationId)
      .maybeSingle();
    if (qualError) throw new Error(qualError.message);
    if (
      !qualification ||
      qualification.organization_id !== organizationId ||
      qualification.archived_at != null
    ) {
      throw new Error("Tätigkeit nicht gefunden");
    }

    const sortOrder = await this.getNextAreaQualificationTemplateSortOrder(
      locationAreaId,
      locationId
    );

    const { error } = await this.client.from(T.areaQualificationTemplates).insert({
      location_area_id: locationAreaId,
      qualification_id: qualificationId,
      sort_order: sortOrder,
    });
    if (error) throw new Error(error.message);
  }

  async removeAreaQualificationTemplate(
    locationAreaId: string,
    locationId: string,
    templateId: string
  ) {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);

    const { data: link, error: linkError } = await this.client
      .from(T.areaQualificationTemplates)
      .select("id, qualification_id")
      .eq("id", templateId)
      .eq("location_area_id", locationAreaId)
      .maybeSingle();
    if (linkError) throw new Error(linkError.message);
    if (!link) throw new Error("Tätigkeitsvorlage nicht gefunden");

    const staffing = await this.listLocationAreaStaffingForArea(
      locationAreaId,
      locationId
    );
    if (
      staffing.some(
        (rule) =>
          rule.qualification_id === link.qualification_id &&
          rule.required_count > 0
      )
    ) {
      throw new Error("Tätigkeit wird noch im Personalbedarf verwendet.");
    }

    const { error } = await this.client
      .from(T.areaQualificationTemplates)
      .delete()
      .eq("id", templateId)
      .eq("location_area_id", locationAreaId);
    if (error) throw new Error(error.message);
  }

  async reorderAreaQualificationTemplates(
    locationAreaId: string,
    locationId: string,
    orderedIds: string[]
  ) {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);
    const { data, error } = await this.client
      .from(T.areaQualificationTemplates)
      .select("id")
      .eq("location_area_id", locationAreaId);
    if (error) throw new Error(error.message);
    validateReorderPermutation(
      (data ?? []).map((row) => row.id as string),
      orderedIds
    );
    await applySortOrderBatch(
      orderedIds.map((id, index) =>
        this.client
          .from(T.areaQualificationTemplates)
          .update({ sort_order: index })
          .eq("id", id)
          .eq("location_area_id", locationAreaId)
      )
    );
  }

  async updateLocation(
    id: string,
    organizationId: string,
    row: { name: string }
  ) {
    const { error } = await this.client
      .from(T.locations)
      .update({ name: row.name })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async listLocationAreaServiceHours(locationId: string) {
    const areas = await this.listLocationAreas(locationId);
    if (!areas.length) return [];
    const areaIds = areas.map((a) => a.id);
    const { data, error } = await this.client
      .from(T.locationAreaServiceHours)
      .select("id, location_area_id, weekday, start_time, end_time")
      .in("location_area_id", areaIds)
      .order("weekday")
      .order("start_time");
    if (error) {
      if (isServiceHoursTableUnavailable(error.message)) return [];
      throw new Error(error.message);
    }
    return (data ?? []) as LocationAreaServiceHour[];
  }

  async listLocationAreaServiceHoursForArea(
    locationAreaId: string,
    locationId: string
  ) {
    const areas = await this.listLocationAreas(locationId);
    if (!areas.some((a) => a.id === locationAreaId)) return [];
    const { data, error } = await this.client
      .from(T.locationAreaServiceHours)
      .select("id, location_area_id, weekday, start_time, end_time")
      .eq("location_area_id", locationAreaId)
      .order("weekday")
      .order("start_time");
    if (error) {
      if (isServiceHoursTableUnavailable(error.message)) return [];
      throw new Error(error.message);
    }
    return (data ?? []) as LocationAreaServiceHour[];
  }

  async replaceLocationAreaServiceHours(
    locationAreaId: string,
    locationId: string,
    rows: { weekday: number; start_time: string; end_time: string }[]
  ) {
    const areas = await this.listLocationAreas(locationId);
    if (!areas.some((a) => a.id === locationAreaId)) {
      throw new Error("Bereich nicht gefunden");
    }

    const { error: delError } = await this.client
      .from(T.locationAreaServiceHours)
      .delete()
      .eq("location_area_id", locationAreaId);
    if (delError) throwServiceHoursDbError(delError.message);

    if (!rows.length) return;

    const { error: insError } = await this.client
      .from(T.locationAreaServiceHours)
      .insert(
        rows.map((r) => ({
          location_area_id: locationAreaId,
          weekday: r.weekday,
          start_time: r.start_time,
          end_time: r.end_time,
        }))
      );
    if (insError) throwServiceHoursDbError(insError.message);
  }

  async ensureLocationAreaServiceHour(
    locationAreaId: string,
    locationId: string,
    row: { weekday: number; start_time: string; end_time: string },
    options?: { excludeServiceHourId?: string }
  ) {
    await this.assertLocationAreaInLocation(locationAreaId, locationId);

    const validated = validateServiceHoursInput([row]);
    if (!validated.ok) throw new Error(validated.error);
    const normalized = validated.data[0]!;

    const existing = await this.listLocationAreaServiceHoursForArea(
      locationAreaId,
      locationId
    );
    const match = existing.find((hour) => serviceHoursSameWindow(hour, normalized));
    if (match) return match;

    const comparableExisting = options?.excludeServiceHourId
      ? existing.filter((hour) => hour.id !== options.excludeServiceHourId)
      : existing;

    const merged = [
      ...comparableExisting.map((hour) => ({
        weekday: hour.weekday,
        start_time: hour.start_time,
        end_time: hour.end_time,
      })),
      {
        weekday: normalized.weekday,
        start_time: normalized.start_time,
        end_time: normalized.end_time,
      },
    ];
    const overlapCheck = validateServiceHoursInput(merged);
    if (!overlapCheck.ok) throw new Error(overlapCheck.error);

    const { data, error } = await this.client
      .from(T.locationAreaServiceHours)
      .insert({
        location_area_id: locationAreaId,
        weekday: normalized.weekday,
        start_time: normalized.start_time,
        end_time: normalized.end_time,
      })
      .select()
      .single();
    if (error) throwServiceHoursDbError(error.message);
    return data as LocationAreaServiceHour;
  }

  async listMyShifts(fromDate: string, toDate: string) {
    const from = clampShiftQueryFromDate(fromDate);
    const { data, error } = await this.client
      .from(T.shifts)
      .select("*")
      .gte("shift_date", from)
      .lte("shift_date", toDate)
      .order("shift_date", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as Shift[];
  }

  async listMyShiftWeekDisplay(fromDate: string, toDate: string) {
    const from = clampShiftQueryFromDate(fromDate);
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, employee_id, location_area_id, locations(name), location_areas(name), area_shift_templates(name, color)"
      )
      .gte("shift_date", from)
      .lte("shift_date", toDate)
      .order("shift_date", { ascending: true });

    if (error) throw new Error(error.message);
    if (!data?.length) return [];

    const employeeIds = [
      ...new Set(
        data
          .map((row) => row.employee_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const areaIds = [
      ...new Set(
        data
          .map((row) => row.location_area_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const profileQualificationsByEmployee = new Map<string, Set<string>>();
    if (employeeIds.length) {
      const { data: profileQualLinks, error: profileQualError } =
        await this.client
          .from(T.profileQualifications)
          .select("profile_id, qualification_id")
          .in("profile_id", employeeIds);
      if (profileQualError) throw new Error(profileQualError.message);

      for (const link of profileQualLinks ?? []) {
        const profileId = link.profile_id as string;
        const qualificationId = link.qualification_id as string;
        const set = profileQualificationsByEmployee.get(profileId) ?? new Set<string>();
        set.add(qualificationId);
        profileQualificationsByEmployee.set(profileId, set);
      }
    }

    const areaQualificationsByArea = new Map<
      string,
      Array<{ qualificationId: string; name: string; sortOrder: number }>
    >();
    if (areaIds.length) {
      const { data: areaQualRows, error: areaQualError } = await this.client
        .from(T.areaQualificationTemplates)
        .select(
          "location_area_id, qualification_id, sort_order, qualifications(name)"
        )
        .in("location_area_id", areaIds)
        .order("sort_order");
      if (areaQualError) throw new Error(areaQualError.message);

      for (const row of areaQualRows ?? []) {
        const areaId = row.location_area_id as string;
        const qualification = relation(
          row.qualifications as { name: string } | { name: string }[] | null
        );
        const name = qualification?.name?.trim();
        if (!name) continue;

        const list = areaQualificationsByArea.get(areaId) ?? [];
        list.push({
          qualificationId: row.qualification_id as string,
          name,
          sortOrder: row.sort_order as number,
        });
        areaQualificationsByArea.set(areaId, list);
      }
    }

    return data.map((row) => {
      const location = relation(
        row.locations as { name: string } | { name: string }[] | null
      );
      const area = relation(
        row.location_areas as { name: string } | { name: string }[] | null
      );
      const template = relation(
        row.area_shift_templates as
          | { name: string; color: string | null }
          | { name: string; color: string | null }[]
          | null
      );
      const employeeId = row.employee_id as string;
      const areaId = row.location_area_id as string | null;
      const employeeQualifications =
        profileQualificationsByEmployee.get(employeeId) ?? new Set<string>();
      const areaQualifications = areaId
        ? (areaQualificationsByArea.get(areaId) ?? [])
        : [];
      const jobName =
        areaQualifications
          .filter((entry) => employeeQualifications.has(entry.qualificationId))
          .map((entry) => entry.name)
          .join(", ") || null;

      return {
        shiftId: row.id as string,
        locationName: location?.name ?? "",
        areaName: area?.name ?? "",
        templateName: template?.name ?? null,
        templateColor: template?.color ?? null,
        jobName,
      };
    });
  }

  async listAreaCalendarShifts(
    organizationId: string,
    from: string,
    to: string,
    locationId: string
  ) {
    const clampedFrom = clampShiftQueryFromDate(from);
    const { data } = await this.client
      .from(T.shifts)
      .select(
        `id, employee_id, location_area_id, area_shift_template_id, shift_date, starts_at, ends_at, confirmation_status, confirmation_status_updated_at, requested_at, pending_since, lifecycle_status, area_shift_templates(name, color, start_time, end_time), profiles!employee_id(full_name, color)`
      )
      .eq("organization_id", organizationId)
      .eq("location_id", locationId)
      .gte("shift_date", clampedFrom)
      .lte("shift_date", to)
      .order("shift_date");
    const rows = (data ?? []) as unknown as AreaCalendarShiftRow[];
    if (!rows.length) return rows;

    const shiftIds = rows.map((row) => row.id);
    const requestsByShiftId = await this.listShiftRequestsForShifts(
      organizationId,
      shiftIds
    );

    return rows.map((row) => ({
      ...row,
      shift_requests: requestsByShiftId.get(row.id),
    }));
  }

  private async listShiftRequestsForShifts(
    organizationId: string,
    shiftIds: string[]
  ): Promise<Map<string, import("./shift-display-state").ShiftRequestSummary[]>> {
    const grouped = new Map<
      string,
      import("./shift-display-state").ShiftRequestSummary[]
    >();
    if (!shiftIds.length) return grouped;

    const { data, error } = await this.client
      .from(T.shiftRequests)
      .select(
        "id, shift_id, type, status, sent_at, responded_at, payload, created_at"
      )
      .eq("organization_id", organizationId)
      .in("shift_id", shiftIds)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const shiftId = row.shift_id as string;
      const list = grouped.get(shiftId) ?? [];
      list.push({
        id: row.id as string,
        shift_id: shiftId,
        type: row.type as import("@schichtwerk/types").ShiftRequestType,
        status: row.status as import("@schichtwerk/types").ShiftRequestStatus,
        sent_at: (row.sent_at as string | null) ?? null,
        responded_at: (row.responded_at as string | null) ?? null,
        payload: (row.payload as Record<string, unknown>) ?? {},
        created_at: row.created_at as string,
      });
      grouped.set(shiftId, list);
    }

    return grouped;
  }

  async getShiftById(id: string, organizationId: string) {
    const { data } = await this.client
      .from(T.shifts)
      .select("id, shift_date")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    return data
      ? { id: data.id as string, shift_date: data.shift_date as string }
      : null;
  }

  async listShiftsForEmployeeDate(employeeId: string, shiftDate: string) {
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, employee_id, location_id, location_area_id, area_shift_template_id, shift_date, starts_at, ends_at, notes, created_by, confirmation_status, requested_at, pending_since, pending_reminder_sent_at"
      )
      .eq("employee_id", employeeId)
      .eq("shift_date", shiftDate)
      .order("starts_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeeShiftRecord[];
  }

  async listShiftsForEmployeeOnDates(employeeId: string, shiftDates: string[]) {
    const uniqueDates = [...new Set(shiftDates.filter(Boolean))];
    if (!uniqueDates.length) return [];

    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, employee_id, location_id, location_area_id, area_shift_template_id, shift_date, starts_at, ends_at, notes, created_by, confirmation_status, requested_at, pending_since, pending_reminder_sent_at"
      )
      .eq("employee_id", employeeId)
      .in("shift_date", uniqueDates)
      .order("starts_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeeShiftRecord[];
  }

  async listShiftsForEmployeeFromDate(employeeId: string, fromDate: string) {
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, employee_id, location_id, location_area_id, area_shift_template_id, shift_date, starts_at, ends_at, notes, created_by, confirmation_status, requested_at, pending_since, pending_reminder_sent_at"
      )
      .eq("employee_id", employeeId)
      .gte("shift_date", fromDate)
      .order("shift_date")
      .order("starts_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeeShiftRecord[];
  }

  async listShiftsForEmployeeInDateRange(
    employeeId: string,
    fromDate: string,
    toDate: string
  ) {
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, employee_id, location_id, location_area_id, area_shift_template_id, shift_date, starts_at, ends_at, notes, created_by, confirmation_status, requested_at, pending_since, pending_reminder_sent_at"
      )
      .eq("employee_id", employeeId)
      .gte("shift_date", fromDate)
      .lte("shift_date", toDate)
      .order("shift_date")
      .order("starts_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeeShiftRecord[];
  }

  async listShiftsForEmployeeRestCheck(
    employeeId: string,
    startsAt: string,
    endsAt: string,
    shiftDate: string
  ) {
    const lookbackMs = 36 * 60 * 60 * 1000;
    const newStartMs = new Date(startsAt).getTime();
    const newEndMs = new Date(endsAt).getTime();
    const lookbackIso = new Date(newStartMs - lookbackMs).toISOString();
    const lookaheadIso = new Date(newEndMs + lookbackMs).toISOString();
    const select =
      "id, employee_id, location_id, location_area_id, area_shift_template_id, shift_date, starts_at, ends_at, notes, created_by, confirmation_status, requested_at, pending_since, pending_reminder_sent_at";

    const [priorResult, nextResult] = await Promise.all([
      this.client
        .from(T.shifts)
        .select(select)
        .eq("employee_id", employeeId)
        .gt("ends_at", lookbackIso)
        .lte("ends_at", startsAt)
        .neq("shift_date", shiftDate)
        .order("ends_at"),
      this.client
        .from(T.shifts)
        .select(select)
        .eq("employee_id", employeeId)
        .gte("starts_at", endsAt)
        .lt("starts_at", lookaheadIso)
        .neq("shift_date", shiftDate)
        .order("starts_at"),
    ]);

    if (priorResult.error) throw new Error(priorResult.error.message);
    if (nextResult.error) throw new Error(nextResult.error.message);

    const byId = new Map<string, EmployeeShiftRecord>();
    for (const row of [...(priorResult.data ?? []), ...(nextResult.data ?? [])]) {
      byId.set(row.id as string, row as EmployeeShiftRecord);
    }
    return [...byId.values()];
  }

  async getShiftRecordById(id: string, organizationId: string) {
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, employee_id, location_id, location_area_id, area_shift_template_id, shift_date, starts_at, ends_at, notes, created_by, confirmation_status, requested_at, pending_since, pending_reminder_sent_at"
      )
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as EmployeeShiftRecord | null) ?? null;
  }

  async listProfileQualificationIdsByOrganization(organizationId: string) {
    const { data: profiles, error: profileError } = await this.client
      .from(T.profiles)
      .select("id")
      .eq("organization_id", organizationId);
    if (profileError) throw new Error(profileError.message);

    const profileIds = (profiles ?? []).map((row) => row.id as string);
    if (!profileIds.length) return new Map<string, string[]>();

    const { data: links, error: linkError } = await this.client
      .from(T.profileQualifications)
      .select("profile_id, qualification_id")
      .in("profile_id", profileIds);
    if (linkError) throw new Error(linkError.message);

    const map = new Map<string, string[]>();
    for (const row of links ?? []) {
      const profileId = row.profile_id as string;
      const qualificationId = row.qualification_id as string;
      const list = map.get(profileId) ?? [];
      list.push(qualificationId);
      map.set(profileId, list);
    }
    return map;
  }

  async insertShift(row: {
    organization_id: string;
    employee_id: string;
    area_shift_template_id?: string | null;
    location_id: string;
    location_area_id?: string | null;
    shift_date: string;
    starts_at: string;
    ends_at: string;
    created_by: string;
    confirmation_status?: import("@schichtwerk/types").ShiftConfirmationStatus;
    confirmation_status_updated_at?: string;
    requested_at?: string | null;
    pending_since?: string | null;
    pending_reminder_sent_at?: string | null;
  }) {
    const { area_shift_template_id, ...rest } = row;
    const payload = enrichShiftRowWithLifecycle(
      area_shift_template_id != null && area_shift_template_id !== ""
        ? { ...rest, area_shift_template_id }
        : rest
    );
    const { data, error } = await this.client
      .from(T.shifts)
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (payload.confirmation_status) {
      await syncShiftRequestsAfterAssignConfirmationStatus({
        client: this.client,
        organizationId: row.organization_id,
        shiftId: data.id as string,
        confirmationStatus: payload.confirmation_status,
        now: payload.confirmation_status_updated_at ?? new Date().toISOString(),
      });
    }

    return { id: data.id as string };
  }

  async updateShift(
    id: string,
    row: {
      area_shift_template_id?: string | null;
      location_id: string;
      location_area_id?: string | null;
      starts_at: string;
      ends_at: string;
      created_by: string;
      confirmation_status?: import("@schichtwerk/types").ShiftConfirmationStatus;
      confirmation_status_updated_at?: string;
      requested_at?: string | null;
      pending_since?: string | null;
      pending_reminder_sent_at?: string | null;
    }
  ) {
    const { area_shift_template_id, ...rest } = row;
    const payload = enrichShiftRowWithLifecycle(
      area_shift_template_id != null && area_shift_template_id !== ""
        ? { ...rest, area_shift_template_id }
        : rest
    );
    const { error } = await this.client.from(T.shifts).update(payload).eq("id", id);
    if (error) throw new Error(error.message);

    if (payload.confirmation_status) {
      const { data: shiftRow, error: orgError } = await this.client
        .from(T.shifts)
        .select("organization_id")
        .eq("id", id)
        .maybeSingle();
      if (orgError) throw new Error(orgError.message);
      if (!shiftRow) throw new Error("Schicht nicht gefunden.");

      await syncShiftRequestsAfterAssignConfirmationStatus({
        client: this.client,
        organizationId: shiftRow.organization_id as string,
        shiftId: id,
        confirmationStatus: payload.confirmation_status,
        now: payload.confirmation_status_updated_at ?? new Date().toISOString(),
      });
    }
  }

  async deleteShift(id: string, organizationId: string, deletedBy: string) {
    const shift = await this.getShiftRecordById(id, organizationId);
    if (!shift) {
      throw new Error("Schicht nicht gefunden");
    }

    const deletedAt = new Date().toISOString();
    const { error: auditError } = await this.client
      .from(T.shiftDeletionEvents)
      .insert({
        organization_id: organizationId,
        shift_id: id,
        deleted_by: deletedBy,
        deleted_at: deletedAt,
        snapshot: buildShiftDeletionSnapshot(shift),
      });
    if (auditError) throw new Error(auditError.message);

    const { error } = await this.client
      .from(T.shifts)
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async resetOrganizationOperationalData(organizationId: string): Promise<void> {
    const profiles = await this.listOrganizationProfiles(organizationId);
    const authUserIds = profiles.map((profile) => profile.id);

    const { error } = await this.client.rpc("reset_organization_operational_data", {
      p_organization_id: organizationId,
    });
    if (error) throw new Error(error.message);

    await Promise.all(authUserIds.map((userId) => this.authDeleteUser(userId)));
  }

  async resetOrganizationShiftData(organizationId: string): Promise<void> {
    const { error } = await this.client.rpc("reset_organization_shift_data", {
      p_organization_id: organizationId,
    });
    if (error) throw new Error(error.message);
  }

  async listOrganizationAbsences(
    organizationId: string,
    options?: {
      statuses?: import("@schichtwerk/types").RequestStatus[];
      employeeId?: string;
    }
  ) {
    let query = this.client
      .from(T.absenceRequests)
      .select(
        "id, organization_id, employee_id, type, start_date, end_date, is_open_ended, expected_end_date, status, notes, reviewed_by, reported_by, updated_at"
      )
      .eq("organization_id", organizationId)
      .order("start_date", { ascending: false });

    if (options?.statuses?.length) {
      query = query.in("status", options.statuses);
    }
    if (options?.employeeId) {
      query = query.eq("employee_id", options.employeeId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as AbsenceRequest[];
  }

  async insertAbsenceRequest(row: {
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
  }) {
    const { data, error } = await this.client
      .from(T.absenceRequests)
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async updateAbsenceRequest(
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
  ) {
    const { error } = await this.client
      .from(T.absenceRequests)
      .update(row)
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async deleteAbsenceRequest(id: string, organizationId: string) {
    const { error } = await this.client
      .from(T.absenceRequests)
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async purgeExpiredAbsenceRequestsBatch(
    purgeCutoffISO: string,
    batchSize = ABSENCE_PURGE_BATCH_SIZE
  ) {
    const { data, error } = await this.client.rpc(
      "purge_expired_absence_requests_batch",
      {
        p_purge_cutoff: purgeCutoffISO,
        p_batch_size: batchSize,
      }
    );
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  }

  async countShiftsConflictingWithAbsenceRanges(
    organizationId: string,
    ranges: { employee_id: string; start_date: string; end_date: string }[]
  ) {
    if (!ranges.length) return 0;

    const { data, error } = await this.client.rpc(
      "count_shifts_conflicting_with_absence_ranges",
      {
        p_organization_id: organizationId,
        p_ranges: ranges,
      }
    );
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  }

  async listOrganizationSwapRequests(
    organizationId: string,
    options?: {
      statuses?: import("@schichtwerk/types").RequestStatus[];
      locationId?: string;
      from?: string;
      to?: string;
    }
  ): Promise<import("@schichtwerk/types").SwapRequestWithShiftContext[]> {
    let query = this.client
      .from(T.swapRequests)
      .select(
        "id, organization_id, requester_id, shift_id, target_employee_id, status, message, reviewed_by, shifts!inner(shift_date, starts_at, ends_at, location_id, location_area_id, profiles!employee_id(full_name), area_shift_templates(name)), requester:profiles!requester_id(full_name), target:profiles!target_employee_id(full_name)"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (options?.statuses?.length) {
      query = query.in("status", options.statuses);
    }
    if (options?.locationId) {
      query = query.eq("shifts.location_id", options.locationId);
    }
    if (options?.from) {
      query = query.gte("shifts.shift_date", options.from);
    }
    if (options?.to) {
      query = query.lte("shifts.shift_date", options.to);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const shift = relation(row.shifts) as {
        shift_date: string;
        starts_at: string;
        ends_at: string;
        location_id: string | null;
        location_area_id: string | null;
        profiles: { full_name: string } | { full_name: string }[] | null;
        area_shift_templates: { name: string } | { name: string }[] | null;
      };
      const assigneeProfile = relation(shift.profiles);
      const template = relation(shift.area_shift_templates);
      const requesterProfile = relation(row.requester) as { full_name: string } | null;
      const targetProfile = relation(row.target) as { full_name: string } | null;

      return {
        id: row.id as string,
        organization_id: row.organization_id as string,
        requester_id: row.requester_id as string,
        shift_id: row.shift_id as string,
        target_employee_id: (row.target_employee_id as string | null) ?? null,
        status: row.status as import("@schichtwerk/types").SwapRequestStatus,
        message: (row.message as string | null) ?? null,
        reviewed_by: (row.reviewed_by as string | null) ?? null,
        shift_date: shift.shift_date,
        starts_at: shift.starts_at,
        ends_at: shift.ends_at,
        location_id: shift.location_id,
        location_area_id: shift.location_area_id,
        assignee_name: assigneeProfile?.full_name ?? "—",
        requester_name: requesterProfile?.full_name ?? "—",
        target_name: targetProfile?.full_name ?? null,
        shift_template_name: template?.name ?? null,
      };
    });
  }

  async listShiftCancelActors(
    organizationId: string,
    shiftIds: string[]
  ): Promise<Map<string, "employee" | "manager">> {
    const result = new Map<string, "employee" | "manager">();
    if (!shiftIds.length) return result;

    const { data, error } = await this.client
      .from(T.shiftConfirmationEvents)
      .select("shift_id, payload, created_at")
      .eq("organization_id", organizationId)
      .eq("to_status", "canceled")
      .in("shift_id", shiftIds)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const shiftId = row.shift_id as string;
      if (result.has(shiftId)) continue;
      const payload = row.payload as { canceled_by?: string } | null;
      const canceledBy = payload?.canceled_by;
      if (canceledBy === "employee" || canceledBy === "manager") {
        result.set(shiftId, canceledBy);
      }
    }

    return result;
  }

  async listProposedShiftsForConfirmationSend(
    organizationId: string,
    options: {
      weekStart: string;
      weekEnd: string;
      locationId?: string;
      employeeId?: string;
    }
  ): Promise<ProposedShiftForSend[]> {
    let query = this.client
      .from(T.shifts)
      .select(
        "id, organization_id, employee_id, location_id, location_area_id, area_shift_template_id, shift_date, starts_at, ends_at, notes, confirmation_status"
      )
      .eq("organization_id", organizationId)
      .eq("confirmation_status", "proposed")
      .gte("shift_date", options.weekStart)
      .lte("shift_date", options.weekEnd);

    if (options.locationId) {
      query = query.eq("location_id", options.locationId);
    }
    if (options.employeeId) {
      query = query.eq("employee_id", options.employeeId);
    }

    const { data, error } = await query.order("shift_date").order("starts_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as ProposedShiftForSend[];
  }

  async listShiftsForConfirmationSendModal(
    organizationId: string,
    options: {
      weekStart: string;
      weekEnd: string;
      locationId?: string;
    }
  ): Promise<ConfirmationSendModalShiftRecord[]> {
    let query = this.client
      .from(T.shifts)
      .select(
        "id, organization_id, employee_id, location_id, location_area_id, area_shift_template_id, shift_date, starts_at, ends_at, notes, confirmation_status, profiles!employee_id(full_name), area_shift_templates(name)"
      )
      .eq("organization_id", organizationId)
      .in("confirmation_status", ["proposed", "requested"])
      .gte("shift_date", options.weekStart)
      .lte("shift_date", options.weekEnd);

    if (options.locationId) {
      query = query.eq("location_id", options.locationId);
    }

    const { data, error } = await query.order("shift_date").order("starts_at");
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const record = row as Record<string, unknown>;
      const profileRel = record.profiles as
        | { full_name: string }
        | { full_name: string }[]
        | null
        | undefined;
      const templateRel = record.area_shift_templates as
        | { name: string }
        | { name: string }[]
        | null
        | undefined;
      const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel;
      const template = Array.isArray(templateRel) ? templateRel[0] : templateRel;

      return {
        id: record.id as string,
        organization_id: record.organization_id as string,
        employee_id: record.employee_id as string,
        location_id: (record.location_id as string | null) ?? null,
        location_area_id: (record.location_area_id as string | null) ?? null,
        area_shift_template_id: (record.area_shift_template_id as string | null) ?? null,
        shift_date: record.shift_date as string,
        starts_at: record.starts_at as string,
        ends_at: record.ends_at as string,
        notes: (record.notes as string | null) ?? null,
        confirmation_status: record.confirmation_status as import("@schichtwerk/types").ShiftConfirmationStatus,
        employee_full_name: profile?.full_name ?? "",
        template_name: template?.name ?? null,
      };
    });
  }

  async getLatestConfirmationSnapshotsByShiftIds(
    shiftIds: string[]
  ): Promise<Map<string, ShiftConfirmationSnapshot>> {
    const uniqueIds = [...new Set(shiftIds.filter(Boolean))];
    const map = new Map<string, ShiftConfirmationSnapshot>();
    if (!uniqueIds.length) return map;

    const { data, error } = await this.client
      .from(T.confirmationRequestItems)
      .select("shift_id, snapshot, created_at")
      .in("shift_id", uniqueIds)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const shiftId = row.shift_id as string;
      if (map.has(shiftId)) continue;
      const snapshot = parseStoredConfirmationSnapshot(row.snapshot);
      if (snapshot) map.set(shiftId, snapshot);
    }

    return map;
  }

  async sendConfirmationRequestForEmployee(input: {
    organizationId: string;
    employeeId: string;
    sentBy: string;
    scope: ConfirmationRequestScope;
    weekStart: string;
    weekEnd: string;
    shifts: ProposedShiftForSend[];
    profile: Pick<Profile, "email_fallback_mode">;
    skipNotificationOutbox?: boolean;
  }): Promise<{ batchId: string; sentCount: number; isDelta: boolean }> {
    const now = new Date().toISOString();
    const shiftIds = input.shifts.map((shift) => shift.id);
    const latestSnapshots = await this.getLatestConfirmationSnapshotsByShiftIds(
      shiftIds
    );
    const sendable = filterSendableProposedShifts(input.shifts, latestSnapshots);
    if (!sendable.length) {
      throw new Error("Keine sendbaren Schichten für diesen Mitarbeiter.");
    }

    const isDelta = confirmationBatchIsDelta(sendable, latestSnapshots);
    const templateKey = resolveConfirmationNotificationTemplateKey(isDelta);
    const channel = resolveConfirmationNotificationChannel(input.profile);

    const { data: batchRow, error: batchError } = await this.client
      .from(T.confirmationRequestBatches)
      .insert({
        organization_id: input.organizationId,
        employee_id: input.employeeId,
        sent_by: input.sentBy,
        scope: input.scope,
        week_start: input.weekStart,
        week_end: input.weekEnd,
        is_delta: isDelta,
      })
      .select("id")
      .single();

    if (batchError || !batchRow) {
      throw new Error(batchError?.message ?? "Versand-Batch fehlgeschlagen");
    }

    const batchId = batchRow.id as string;

    // Each shift's writes are independent — run them in parallel to reduce latency.
    // Note: if any shift fails partway through, the batch row and already-processed
    // shifts remain committed (no cross-shift transaction). Callers should treat a
    // partial failure as retriable; the shift.confirmation_status guard prevents
    // double-processing already-requested shifts.
    await Promise.all(
      sendable.map(async (shift) => {
        const snapshot = shiftToConfirmationSnapshot(shift);
        const fromStatus = shift.confirmation_status ?? "proposed";

        const { error: itemError } = await this.client
          .from(T.confirmationRequestItems)
          .insert({
            batch_id: batchId,
            shift_id: shift.id,
            snapshot,
          });
        if (itemError) throw new Error(itemError.message);

        const { error: shiftError } = await this.client
          .from(T.shifts)
          .update({
            confirmation_status: "requested",
            lifecycle_status: "planned",
            confirmation_status_updated_at: now,
            requested_at: now,
            pending_since: null,
            pending_reminder_sent_at: null,
          })
          .eq("id", shift.id)
          .eq("organization_id", input.organizationId)
          .eq("confirmation_status", "proposed");

        if (shiftError) throw new Error(shiftError.message);

        await syncShiftRequestsAfterConfirmationSent({
          client: this.client,
          organizationId: input.organizationId,
          shiftId: shift.id,
          actorId: input.sentBy,
          sentAt: now,
          payload: {
            batch_id: batchId,
            scope: input.scope,
            is_delta: isDelta,
          },
        });

        const { error: eventError } = await this.client
          .from(T.shiftConfirmationEvents)
          .insert({
            organization_id: input.organizationId,
            shift_id: shift.id,
            actor_id: input.sentBy,
            from_status: fromStatus,
            to_status: "requested",
            payload: {
              batch_id: batchId,
              scope: input.scope,
              is_delta: isDelta,
            },
          });
        if (eventError) throw new Error(eventError.message);
      })
    );

    if (!input.skipNotificationOutbox) {
      const { error: outboxError } = await this.client
        .from(T.notificationOutbox)
        .insert({
          organization_id: input.organizationId,
          recipient_profile_id: input.employeeId,
          channel,
          template_key: templateKey,
          payload: {
            batch_id: batchId,
            scope: input.scope,
            week_start: input.weekStart,
            week_end: input.weekEnd,
            shift_count: sendable.length,
            is_delta: isDelta,
          },
          simulated: true,
        });
      if (outboxError) throw new Error(outboxError.message);
    }

    return {
      batchId,
      sentCount: sendable.length,
      isDelta,
    };
  }

  async resendConfirmationRequestsForShifts(input: {
    organizationId: string;
    sentBy: string;
    shiftIds: string[];
  }): Promise<{
    sentCount: number;
    failed: Array<{ shiftId: string; error: string }>;
  }> {
    const nowIso = new Date().toISOString();
    const resendableStatuses = new Set(["requested", "pending", "rejected"]);
    let sentCount = 0;
    const failed: Array<{ shiftId: string; error: string }> = [];

    for (const shiftId of input.shiftIds) {
      try {
        const shift = await this.getShiftRecordById(shiftId, input.organizationId);
        if (!shift) {
          failed.push({ shiftId, error: "Schicht nicht gefunden." });
          continue;
        }

        const fromStatus = shift.confirmation_status;
        if (!fromStatus || !resendableStatuses.has(fromStatus)) {
          failed.push({
            shiftId,
            error: "Schicht kann nicht erneut angefragt werden.",
          });
          continue;
        }

        const profile = await this.getProfileById(shift.employee_id);
        if (!profile || profile.organization_id !== input.organizationId) {
          failed.push({ shiftId, error: "Mitarbeiter nicht gefunden." });
          continue;
        }

        const { error: updateError } = await this.client
          .from(T.shifts)
          .update({
            confirmation_status: "requested",
            lifecycle_status: "planned",
            confirmation_status_updated_at: nowIso,
            requested_at: nowIso,
            pending_since: null,
            pending_reminder_sent_at: null,
          })
          .eq("id", shiftId)
          .eq("organization_id", input.organizationId)
          .in("confirmation_status", ["requested", "pending", "rejected"]);

        if (updateError) {
          failed.push({ shiftId, error: updateError.message });
          continue;
        }

        await syncShiftRequestsAfterConfirmationResent({
          client: this.client,
          organizationId: input.organizationId,
          shiftId,
          actorId: input.sentBy,
          sentAt: nowIso,
          payload: { resend: true },
        });

        const { error: eventError } = await this.client
          .from(T.shiftConfirmationEvents)
          .insert({
            organization_id: input.organizationId,
            shift_id: shiftId,
            actor_id: input.sentBy,
            from_status: fromStatus,
            to_status: "requested",
            payload: { resend: true },
          });
        if (eventError) {
          failed.push({ shiftId, error: eventError.message });
          continue;
        }

        const channel = resolveConfirmationNotificationChannel(profile);
        const { error: outboxError } = await this.client
          .from(T.notificationOutbox)
          .insert({
            organization_id: input.organizationId,
            recipient_profile_id: shift.employee_id,
            channel,
            template_key: "confirmation_request_delta",
            payload: {
              shift_id: shiftId,
              shift_date: shift.shift_date,
              resend: true,
            },
            simulated: true,
          });
        if (outboxError) {
          failed.push({ shiftId, error: outboxError.message });
          continue;
        }

        sentCount += 1;
      } catch (error) {
        failed.push({
          shiftId,
          error: error instanceof Error ? error.message : "Erneut anfragen fehlgeschlagen.",
        });
      }
    }

    return { sentCount, failed };
  }

  async runShiftConfirmationPendingJob(
    nowInput?: Date
  ): Promise<ShiftConfirmationPendingJobResult> {
    const now = nowInput ?? new Date();
    const nowIso = now.toISOString();
    const result: ShiftConfirmationPendingJobResult = {
      scanned: 0,
      transitioned: 0,
      errors: [],
    };

    const requestedShifts = await this.listRequestedShiftsForPendingJob();
    result.scanned = requestedShifts.length;

    const dueShifts = filterRequestedShiftsDueForPendingTransition(
      requestedShifts,
      now
    );

    const managerRecipientsByOrg = new Map<string, string[]>();

    for (const shift of dueShifts) {
      try {
        const transitioned = await this.transitionShiftToPending(shift, nowIso);
        if (!transitioned) continue;

        result.transitioned += 1;

        let managerRecipientIds = managerRecipientsByOrg.get(shift.organization_id);
        if (!managerRecipientIds) {
          const profiles = await this.listOrganizationProfiles(shift.organization_id);
          managerRecipientIds = profiles
            .filter((profile) => profile.role === "admin" || profile.role === "manager")
            .map((profile) => profile.id);
          managerRecipientsByOrg.set(shift.organization_id, managerRecipientIds);
        }

        const channel = shift.email_fallback_mode ? "email" : "push";
        const { error: outboxError } = await this.client
          .from(T.notificationOutbox)
          .insert({
            organization_id: shift.organization_id,
            recipient_profile_id: shift.employee_id,
            channel,
            template_key: "confirmation_pending_reminder",
            payload: {
              shift_id: shift.id,
              shift_date: shift.shift_date,
              requested_at: shift.requested_at,
            },
            simulated: true,
          });
        if (outboxError) throw new Error(outboxError.message);

        if (managerRecipientIds.length > 0) {
          const title = buildManagerPendingEscalationTitle(shift.employee_full_name);
          const body = buildManagerPendingEscalationBody(shift.employee_full_name);
          const { error: managerError } = await this.client
            .from(T.managerNotifications)
            .insert(
              managerRecipientIds.map((recipientId) => ({
                organization_id: shift.organization_id,
                recipient_profile_id: recipientId,
                type: "employee_pending_escalation",
                title,
                body,
                payload: {
                  shift_id: shift.id,
                  employee_id: shift.employee_id,
                  employee_name: shift.employee_full_name,
                  shift_date: shift.shift_date,
                },
              }))
            );
          if (managerError) throw new Error(managerError.message);
        }
      } catch (error) {
        result.errors.push({
          shiftId: shift.id,
          error: error instanceof Error ? error.message : "Pending-Übergang fehlgeschlagen.",
        });
      }
    }

    return result;
  }

  private async listRequestedShiftsForPendingJob(): Promise<
    RequestedShiftForPendingJob[]
  > {
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, organization_id, employee_id, shift_date, requested_at, organizations!inner(shift_confirmation_enabled, timezone, country_code), profiles!employee_id(full_name, email_fallback_mode)"
      )
      .eq("confirmation_status", "requested")
      .not("requested_at", "is", null);

    if (error) throw new Error(error.message);

    return (data ?? []).flatMap((row) => {
      const orgRel = row.organizations as
        | {
            shift_confirmation_enabled: boolean;
            timezone: string | null;
            country_code: string | null;
          }
        | {
            shift_confirmation_enabled: boolean;
            timezone: string | null;
            country_code: string | null;
          }[]
        | null;
      const profileRel = row.profiles as
        | { full_name: string; email_fallback_mode: boolean | null }
        | { full_name: string; email_fallback_mode: boolean | null }[]
        | null;
      const organization = Array.isArray(orgRel) ? orgRel[0] : orgRel;
      const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel;
      const requestedAt = row.requested_at as string | null;

      if (!requestedAt || !profile || !organization) {
        return [];
      }

      return [
        {
          id: row.id as string,
          organization_id: row.organization_id as string,
          employee_id: row.employee_id as string,
          shift_date: row.shift_date as string,
          requested_at: requestedAt,
          employee_full_name: profile.full_name,
          email_fallback_mode: profile.email_fallback_mode ?? false,
          organization: {
            timezone: organization?.timezone ?? null,
            country_code: organization?.country_code ?? null,
          },
        },
      ];
    });
  }

  private async transitionShiftToPending(
    shift: RequestedShiftForPendingJob,
    nowIso: string
  ): Promise<boolean> {
    const elapsedMinutes = elapsedMinutesBetween(shift.requested_at, nowIso);

    const { data, error } = await this.client
      .from(T.shifts)
      .update({
        confirmation_status: "pending",
        lifecycle_status: "planned",
        confirmation_status_updated_at: nowIso,
        pending_since: nowIso,
        pending_reminder_sent_at: nowIso,
      })
      .eq("id", shift.id)
      .eq("organization_id", shift.organization_id)
      .eq("confirmation_status", "requested")
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return false;

    await syncShiftRequestsAfterConfirmationExpired({
      client: this.client,
      organizationId: shift.organization_id,
      shiftId: shift.id,
      now: nowIso,
    });

    const { error: eventError } = await this.client
      .from(T.shiftConfirmationEvents)
      .insert({
        organization_id: shift.organization_id,
        shift_id: shift.id,
        actor_id: null,
        from_status: "requested",
        to_status: "pending",
        payload: {
          reason: "pending_job",
          requested_at: shift.requested_at,
          elapsed_minutes: elapsedMinutes,
        },
      });
    if (eventError) throw new Error(eventError.message);

    return true;
  }

  async listManagerNotificationsForRecipient(
    recipientProfileId: string,
    options?: { limit?: number; includeDismissed?: boolean }
  ) {
    let query = this.client
      .from(T.managerNotifications)
      .select(
        "id, organization_id, recipient_profile_id, type, title, body, payload, read_at, dismissed_at, created_at"
      )
      .eq("recipient_profile_id", recipientProfileId)
      .order("created_at", { ascending: false });

    if (!options?.includeDismissed) {
      query = query.is("dismissed_at", null);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id as string,
      organization_id: row.organization_id as string,
      recipient_profile_id: row.recipient_profile_id as string,
      type: row.type as string,
      title: row.title as string,
      body: row.body as string,
      payload: (row.payload as Record<string, unknown>) ?? {},
      read_at: (row.read_at as string | null) ?? null,
      dismissed_at: (row.dismissed_at as string | null) ?? null,
      created_at: row.created_at as string,
    }));
  }

  async dismissManagerNotification(
    notificationId: string,
    recipientProfileId: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(T.managerNotifications)
      .update({
        dismissed_at: now,
        read_at: now,
      })
      .eq("id", notificationId)
      .eq("recipient_profile_id", recipientProfileId)
      .is("dismissed_at", null);

    if (error) throw new Error(error.message);
  }

  async listNotificationOutboxEntries(
    organizationId: string,
    options?: { limit?: number }
  ) {
    let query = this.client
      .from(T.notificationOutbox)
      .select(
        "id, organization_id, recipient_profile_id, channel, template_key, payload, simulated, created_at, profiles!recipient_profile_id(full_name)"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const profileRel = row.profiles as
        | { full_name: string }
        | { full_name: string }[]
        | null;
      const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel;
      return {
        id: row.id as string,
        organization_id: row.organization_id as string,
        recipient_profile_id: row.recipient_profile_id as string,
        channel: row.channel as import("@schichtwerk/types").NotificationOutboxChannel,
        template_key: row.template_key as string,
        payload: (row.payload as Record<string, unknown>) ?? {},
        simulated: row.simulated as boolean,
        created_at: row.created_at as string,
        recipient_full_name: profile?.full_name ?? "",
      };
    });
  }

  async listEmployeeConfirmationWeekItems(
    employeeId: string,
    organizationId: string,
    from: string,
    to: string,
    organizationDisclaimer: string | null
  ): Promise<ConfirmationWeekResponse> {
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, shift_date, starts_at, ends_at, confirmation_status, locations!inner(name), location_areas(name), area_shift_templates(name)"
      )
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .in("confirmation_status", ["requested", "pending"])
      .gte("shift_date", from)
      .lte("shift_date", to)
      .order("shift_date", { ascending: true })
      .order("starts_at", { ascending: true });

    if (error) throw new Error(error.message);

    const items = (data ?? [])
      .map((row) =>
        mapConfirmationWeekRow(
          row as Record<string, unknown>,
          organizationDisclaimer
        )
      )
      .filter((item): item is ConfirmationWeekItem => item !== null);

    return {
      items,
      organizationDisclaimer,
    };
  }

  async listEmployeePendingConfirmationItems(
    employeeId: string,
    organizationId: string,
    fromDate: string,
    organizationDisclaimer: string | null
  ): Promise<ConfirmationWeekResponse> {
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, shift_date, starts_at, ends_at, confirmation_status, locations!inner(name), location_areas(name), area_shift_templates(name)"
      )
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .in("confirmation_status", ["requested", "pending"])
      .gte("shift_date", fromDate)
      .order("shift_date", { ascending: true })
      .order("starts_at", { ascending: true });

    if (error) throw new Error(error.message);

    const items = (data ?? [])
      .map((row) =>
        mapConfirmationWeekRow(
          row as Record<string, unknown>,
          organizationDisclaimer
        )
      )
      .filter((item): item is ConfirmationWeekItem => item !== null);

    return {
      items,
      organizationDisclaimer,
    };
  }

  async getEmployeeConfirmationShiftItem(
    employeeId: string,
    organizationId: string,
    shiftId: string,
    organizationDisclaimer: string | null
  ): Promise<ConfirmationWeekItem | null> {
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, shift_date, starts_at, ends_at, confirmation_status, locations!inner(name), location_areas(name), area_shift_templates(name)"
      )
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .eq("id", shiftId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return mapConfirmationWeekRow(
      data as Record<string, unknown>,
      organizationDisclaimer
    );
  }

  async submitEmployeeConfirmationResponses(input: {
    organizationId: string;
    employeeId: string;
    employeeName: string;
    items: ConfirmationRespondItem[];
  }): Promise<{
    updatedCount: number;
    updatedShifts: { locationId: string | null; shiftDate: string }[];
  }> {
    const validation = validateConfirmationRespondItems(input.items);
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const shiftIds = input.items.map((item) => item.shiftId);
    const { data: shiftRows, error: shiftError } = await this.client
      .from(T.shifts)
      .select("id, employee_id, confirmation_status, location_id, shift_date")
      .eq("organization_id", input.organizationId)
      .in("id", shiftIds);

    if (shiftError) throw new Error(shiftError.message);

    const openShiftsById = new Map(
      (shiftRows ?? []).map((row) => [
        row.id as string,
        {
          id: row.id as string,
          employee_id: row.employee_id as string,
          confirmation_status: row.confirmation_status as import("@schichtwerk/types").ShiftConfirmationStatus,
          location_id: (row.location_id as string | null) ?? null,
          shift_date: row.shift_date as string,
        },
      ])
    );

    const allowed = assertRespondItemsAllowed(
      input.items,
      openShiftsById,
      input.employeeId
    );
    if (!allowed.ok) {
      throw new Error(allowed.error);
    }

    const now = new Date().toISOString();
    const updatedShiftIds: string[] = [];
    const updatedShifts: { locationId: string | null; shiftDate: string }[] = [];

    for (const item of input.items) {
      const current = openShiftsById.get(item.shiftId)!;
      const toStatus = decisionToConfirmationStatus(item.decision);
      const lifecycleStatus = lifecycleStatusForConfirmationStatus(toStatus);

      const { data: updated, error: updateError } = await this.client
        .from(T.shifts)
        .update({
          confirmation_status: toStatus,
          lifecycle_status: lifecycleStatus,
          confirmation_status_updated_at: now,
          pending_since: null,
          pending_reminder_sent_at: null,
        })
        .eq("id", item.shiftId)
        .eq("organization_id", input.organizationId)
        .eq("employee_id", input.employeeId)
        .eq("confirmation_status", current.confirmation_status)
        .select("id")
        .maybeSingle();

      if (updateError) throw new Error(updateError.message);
      if (!updated) {
        throw new Error("Schicht konnte nicht aktualisiert werden.");
      }

      await syncShiftRequestsAfterEmployeeResponse({
        client: this.client,
        organizationId: input.organizationId,
        shiftId: item.shiftId,
        employeeId: input.employeeId,
        decision: item.decision,
        now,
      });

      updatedShiftIds.push(item.shiftId);
      updatedShifts.push({
        locationId: current.location_id,
        shiftDate: current.shift_date,
      });

      const { error: eventError } = await this.client
        .from(T.shiftConfirmationEvents)
        .insert({
          organization_id: input.organizationId,
          shift_id: item.shiftId,
          actor_id: input.employeeId,
          from_status: current.confirmation_status,
          to_status: toStatus,
          payload: {
            decision: item.decision,
            source: "mobile_respond",
          },
        });
      if (eventError) throw new Error(eventError.message);
    }

    const summary = buildManagerResponseSummaryNotification({
      employeeName: input.employeeName,
      decisions: input.items.map((item) => item.decision),
      shiftIds: updatedShiftIds,
    });

    const managers = await this.listOrganizationProfiles(input.organizationId);
    const managerRecipientIds = managers
      .filter((profile) => profile.role === "admin" || profile.role === "manager")
      .map((profile) => profile.id);

    if (managerRecipientIds.length > 0) {
      const { error: managerError } = await this.client
        .from(T.managerNotifications)
        .insert(
          managerRecipientIds.map((recipientId) => ({
            organization_id: input.organizationId,
            recipient_profile_id: recipientId,
            type: summary.type,
            title: summary.title,
            body: summary.body,
            payload: {
              ...summary.payload,
              employee_id: input.employeeId,
            },
          }))
        );
      if (managerError) throw new Error(managerError.message);
    }

    return { updatedCount: updatedShiftIds.length, updatedShifts };
  }

  async cancelShift(input: {
    organizationId: string;
    shiftId: string;
    actorId: string;
    actorRole: "manager" | "employee";
    employeeName?: string;
  }): Promise<{
    locationId: string | null;
    shiftDate: string;
    employeeId: string;
  }> {
    const shift = await this.getShiftRecordById(input.shiftId, input.organizationId);
    if (!shift) {
      throw new Error("Schicht nicht gefunden.");
    }

    if (isShiftDateInPast(shift.shift_date)) {
      throw new Error(SHIFT_CANCEL_PAST_ERROR);
    }

    const storedStatus = shift.confirmation_status ?? "confirmed";
    if (!canCancelShiftByConfirmationStatus(storedStatus, shift.requested_at)) {
      throw new Error(shiftCancelBlockedActionError(storedStatus));
    }

    if (input.actorRole === "employee" && shift.employee_id !== input.actorId) {
      throw new Error(SHIFT_CANCEL_NOT_OWNER_ERROR);
    }

    if (input.actorRole === "manager") {
      if (storedStatus === "confirmed") {
        const employeeProfile = await this.getProfileById(shift.employee_id);
        const channel = resolveConfirmationNotificationChannel(
          employeeProfile ?? { email_fallback_mode: false }
        );
        const { error: outboxError } = await this.client
          .from(T.notificationOutbox)
          .insert({
            organization_id: input.organizationId,
            recipient_profile_id: shift.employee_id,
            channel,
            template_key: "shift_canceled_by_manager",
            payload: {
              shift_id: input.shiftId,
              shift_date: shift.shift_date,
              starts_at: shift.starts_at,
              ends_at: shift.ends_at,
              canceled_by: "manager",
            },
            simulated: true,
          });
        if (outboxError) throw new Error(outboxError.message);

        const { error: eventError } = await this.client
          .from(T.shiftConfirmationEvents)
          .insert({
            organization_id: input.organizationId,
            shift_id: input.shiftId,
            actor_id: input.actorId,
            from_status: storedStatus,
            to_status: "canceled",
            payload: {
              canceled_by: input.actorRole,
              source: "manager_storno_confirmed",
              deleted: true,
            },
          });
        if (eventError) throw new Error(eventError.message);
      }

      await this.deleteShift(input.shiftId, input.organizationId, input.actorId);
      return {
        locationId: shift.location_id,
        shiftDate: shift.shift_date,
        employeeId: shift.employee_id,
      };
    }

    const employeeProfile =
      input.employeeName != null
        ? null
        : await this.getProfileById(shift.employee_id);
    const employeeName =
      input.employeeName ??
      employeeProfile?.full_name ??
      "Mitarbeiter";

    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await this.client
      .from(T.shifts)
      .update({
        confirmation_status: "canceled",
        lifecycle_status: "cancelled",
        confirmation_status_updated_at: now,
        requested_at: null,
        pending_since: null,
        pending_reminder_sent_at: null,
      })
      .eq("id", input.shiftId)
      .eq("organization_id", input.organizationId)
      .eq("confirmation_status", storedStatus)
      .select("id")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updated) {
      throw new Error("Schicht konnte nicht abgesagt werden.");
    }

    await syncShiftRequestsAfterCancellation({
      client: this.client,
      organizationId: input.organizationId,
      shiftId: input.shiftId,
      actorId: input.actorId,
      cancelledBy: "employee",
      now,
      payload: { source: "mobile_cancel" },
    });

    const { error: eventError } = await this.client
      .from(T.shiftConfirmationEvents)
      .insert({
        organization_id: input.organizationId,
        shift_id: input.shiftId,
        actor_id: input.actorId,
        from_status: storedStatus,
        to_status: "canceled",
        payload: {
          canceled_by: input.actorRole,
          source: "mobile_cancel",
        },
      });
    if (eventError) throw new Error(eventError.message);

    const notification = buildManagerShiftCanceledNotification({
      employeeName,
      canceledBy: "employee",
      shiftDate: shift.shift_date,
      shiftId: input.shiftId,
      employeeId: shift.employee_id,
    });

    const managers = await this.listOrganizationProfiles(input.organizationId);
    const managerRecipientIds = managers
      .filter((profile) => profile.role === "admin" || profile.role === "manager")
      .map((profile) => profile.id);

    if (managerRecipientIds.length > 0) {
      const { error: managerError } = await this.client
        .from(T.managerNotifications)
        .insert(
          managerRecipientIds.map((recipientId) => ({
            organization_id: input.organizationId,
            recipient_profile_id: recipientId,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            payload: notification.payload,
          }))
        );
      if (managerError) throw new Error(managerError.message);
    }

    return {
      locationId: shift.location_id,
      shiftDate: shift.shift_date,
      employeeId: shift.employee_id,
    };
  }

  async confirmPastShiftAsManager(input: {
    organizationId: string;
    shiftId: string;
    actorId: string;
  }): Promise<{
    locationId: string | null;
    shiftDate: string;
  }> {
    const shift = await this.getShiftRecordById(input.shiftId, input.organizationId);
    if (!shift) {
      throw new Error("Schicht nicht gefunden.");
    }

    assertCanConfirmPastShiftAsManager({
      shiftDate: shift.shift_date,
      confirmationStatus: shift.confirmation_status,
      requestedAt: shift.requested_at ?? null,
    });

    const storedStatus = shift.confirmation_status ?? "confirmed";
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await this.client
      .from(T.shifts)
      .update({
        confirmation_status: "confirmed",
        lifecycle_status: "confirmed",
        confirmation_status_updated_at: now,
        requested_at: null,
        pending_since: null,
        pending_reminder_sent_at: null,
      })
      .eq("id", input.shiftId)
      .eq("organization_id", input.organizationId)
      .eq("confirmation_status", storedStatus)
      .select("id")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updated) {
      throw new Error("Schicht konnte nicht bestätigt werden.");
    }

    await syncShiftRequestsAfterManagerPastConfirm({
      client: this.client,
      organizationId: input.organizationId,
      shiftId: input.shiftId,
      actorId: input.actorId,
      now,
    });

    const { error: eventError } = await this.client
      .from(T.shiftConfirmationEvents)
      .insert({
        organization_id: input.organizationId,
        shift_id: input.shiftId,
        actor_id: input.actorId,
        from_status: storedStatus,
        to_status: "confirmed",
        payload: {
          source: "manager_past_confirm",
        },
      });
    if (eventError) throw new Error(eventError.message);

    return {
      locationId: shift.location_id,
      shiftDate: shift.shift_date,
    };
  }

  async listOrganizationShiftsForSuperadmin(
    organizationId: string
  ): Promise<SuperadminShiftRecord[]> {
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        `id, shift_date, starts_at, ends_at, confirmation_status, requested_at,
        employee_id, location_id, location_area_id,
        profiles!employee_id(full_name),
        locations(name),
        location_areas(name),
        area_shift_templates(name)`
      )
      .eq("organization_id", organizationId)
      .order("shift_date", { ascending: false })
      .order("starts_at", { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const profile = row.profiles as { full_name?: string } | null;
      const location = row.locations as { name?: string } | null;
      const area = row.location_areas as { name?: string } | null;
      const template = row.area_shift_templates as { name?: string } | null;

      return {
        id: row.id as string,
        shift_date: row.shift_date as string,
        starts_at: row.starts_at as string,
        ends_at: row.ends_at as string,
        confirmation_status: row.confirmation_status as import("@schichtwerk/types").ShiftConfirmationStatus,
        requested_at: (row.requested_at as string | null) ?? null,
        employee_id: row.employee_id as string,
        employee_name: profile?.full_name ?? "—",
        location_id: (row.location_id as string | null) ?? null,
        location_name: location?.name ?? null,
        location_area_id: (row.location_area_id as string | null) ?? null,
        area_name: area?.name ?? null,
        template_name: template?.name ?? null,
      };
    });
  }

  async updateShiftConfirmationStatusAsSuperadmin(input: {
    organizationId: string;
    shiftId: string;
    actorId: string;
    confirmationStatus: import("@schichtwerk/types").ShiftConfirmationStatus;
  }): Promise<{ locationId: string | null; shiftDate: string }> {
    const shift = await this.getShiftRecordById(input.shiftId, input.organizationId);
    if (!shift) {
      throw new Error("Schicht nicht gefunden.");
    }

    const storedStatus = shift.confirmation_status ?? "confirmed";
    if (storedStatus === input.confirmationStatus) {
      return {
        locationId: shift.location_id,
        shiftDate: shift.shift_date,
      };
    }

    const now = new Date().toISOString();
    const patch = buildSuperadminConfirmationStatusPatch(
      input.confirmationStatus,
      now
    );

    const { data: updated, error: updateError } = await this.client
      .from(T.shifts)
      .update(patch)
      .eq("id", input.shiftId)
      .eq("organization_id", input.organizationId)
      .select("id")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updated) {
      throw new Error("Schichtstatus konnte nicht gespeichert werden.");
    }

    await syncShiftRequestsForSuperadminStatus({
      client: this.client,
      organizationId: input.organizationId,
      shiftId: input.shiftId,
      actorId: input.actorId,
      toStatus: input.confirmationStatus,
      now,
    });

    const { error: eventError } = await this.client
      .from(T.shiftConfirmationEvents)
      .insert({
        organization_id: input.organizationId,
        shift_id: input.shiftId,
        actor_id: input.actorId,
        from_status: storedStatus,
        to_status: input.confirmationStatus,
        payload: {
          source: "superadmin_simulation",
        },
      });
    if (eventError) throw new Error(eventError.message);

    return {
      locationId: shift.location_id,
      shiftDate: shift.shift_date,
    };
  }

  async getManagerProfile(userId: string) {
    return this.getProfileById(userId);
  }
}

/** Factory: Supabase-Adapter (aktueller Standard). */
export function createDatabase(client: SupabaseClient): SchichtwerkDatabase {
  return new SupabaseSchichtwerkDatabase(client);
}
