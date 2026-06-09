import type {
  AbsenceRequest,
  AbsenceType,
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
  Profile,
  ProfileHourlyRate,
  ProfileHourlyRateSummary,
  ProfileRecurringAvailability,
  Qualification,
  Role,
  RolePermissionLevel,
  Shift,
  ShiftType,
  ShiftTypeWithBreaks,
} from "@schichtwerk/types";
import type { Session } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Schema } from "./schema";
import type {
  AuthSignUpResult,
  AvailabilityRow,
  DashboardShiftRow,
  EmployeeShiftRecord,
  InviteUserResult,
  SchichtwerkDatabase,
  ShiftTypeBreakInput,
  ShiftWithTypeRow,
} from "./interface";
import {
  isDateWithinAbsenceRange,
} from "./absence-validation";
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
import {
  isServiceHoursTableUnavailable,
  SERVICE_HOURS_MIGRATION_HINT,
} from "./location-service-hours";
import {
  parseAvailabilityTimeRange,
  parseAvailabilityWeekday,
  validateNoOverlappingAvailability,
} from "./profile-availability-validation";
import {
  dedupeShiftTypes,
  normalizeShiftTypesWithBreaks,
  normalizeTime,
  replaceShiftTypeBreaks,
  seedDefaultAreaServiceHours,
  seedDefaultLocationAreas,
  seedDefaultRoles,
  seedDefaultShiftTypes,
} from "./utils";

const T = Schema.tables;
const PROFILE_SELECT = "*, roles!inner(permission_level)";

function throwServiceHoursDbError(message: string): never {
  if (isServiceHoursTableUnavailable(message)) {
    throw new Error(SERVICE_HOURS_MIGRATION_HINT);
  }
  throw new Error(message);
}

type ProfileRow = Omit<Profile, "role"> & {
  roles: { permission_level: RolePermissionLevel } | { permission_level: RolePermissionLevel }[];
};

function mapProfile(row: ProfileRow): Profile {
  const roleRel = Array.isArray(row.roles) ? row.roles[0] : row.roles;
  const { roles: _roles, ...rest } = row;
  return {
    ...rest,
    role: roleRel?.permission_level ?? "basic",
  };
}

const PROFILE_HOURLY_RATE_SELECT =
  "*, creator:created_by(full_name)";

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
  shift_type_id: string | null;
  sort_order: number;
  created_at: string;
  shift_types:
    | { name: string }
    | { name: string }[]
    | null;
};

function mapProfileRecurringAvailability(
  row: ProfileRecurringAvailabilityRow
): ProfileRecurringAvailability {
  const shiftRel = Array.isArray(row.shift_types)
    ? row.shift_types[0]
    : row.shift_types;
  return {
    id: row.id,
    organization_id: row.organization_id,
    profile_id: row.profile_id,
    weekday: row.weekday,
    start_time: row.start_time,
    end_time: row.end_time,
    shift_type_id: row.shift_type_id,
    shift_type_name: shiftRel?.name ?? null,
    sort_order: row.sort_order,
    created_at: row.created_at,
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

  async authDeleteUser(userId: string) {
    const admin = this.client.auth.admin;
    if (admin?.deleteUser) await admin.deleteUser(userId);
  }

  async createOrganization(name: string) {
    const { data, error } = await this.client
      .from(T.organizations)
      .insert({ name })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Organisation fehlgeschlagen");
    return { id: data.id as string };
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
    const level = Array.isArray(roleRel) ? roleRel[0]?.permission_level : roleRel?.permission_level;
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

  async listShiftTypes(organizationId: string) {
    const { data } = await this.client
      .from(T.shiftTypes)
      .select("*")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("sort_order");
    return dedupeShiftTypes((data ?? []) as ShiftType[]);
  }

  async listShiftTypesForPlanning(
    organizationId: string,
    from: string,
    to: string
  ) {
    const active = await this.listShiftTypes(organizationId);
    const known = new Set(active.map((t) => t.id));

    const { data: shiftRows, error } = await this.client
      .from(T.shifts)
      .select("shift_type_id")
      .eq("organization_id", organizationId)
      .gte("shift_date", from)
      .lte("shift_date", to);
    if (error) throw new Error(error.message);

    const extraIds = [
      ...new Set(
        (shiftRows ?? [])
          .map((r) => r.shift_type_id as string)
          .filter((id) => id && !known.has(id))
      ),
    ];
    if (!extraIds.length) return active;

    const { data: historical, error: histErr } = await this.client
      .from(T.shiftTypes)
      .select("*")
      .in("id", extraIds)
      .order("sort_order");
    if (histErr) throw new Error(histErr.message);

    return dedupeShiftTypes(
      [...active, ...((historical ?? []) as ShiftType[])].sort(
        (a, b) => a.sort_order - b.sort_order
      )
    );
  }

  async loadShiftTypesWithBreaks(organizationId: string) {
    let { data } = await this.client
      .from(T.shiftTypes)
      .select(`*, ${T.shiftTypeBreaks}(*)`)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("sort_order");

    if (!data?.length) {
      await seedDefaultShiftTypes(this.client, organizationId);
      const res = await this.client
        .from(T.shiftTypes)
        .select(`*, ${T.shiftTypeBreaks}(*)`)
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("sort_order");
      data = res.data;
    }

    return dedupeShiftTypes(
      normalizeShiftTypesWithBreaks(data ?? [])
    );
  }

  async loadShiftTypesWithBreaksForDashboard(
    organizationId: string,
    staffingRules: { shift_type_id: string; required_count: number }[]
  ) {
    const active = await this.loadShiftTypesWithBreaks(organizationId);
    const known = new Set(active.map((type) => type.id));
    const extraIds = [
      ...new Set(
        staffingRules
          .filter((rule) => rule.required_count > 0)
          .map((rule) => rule.shift_type_id)
          .filter((id) => id && !known.has(id))
      ),
    ];
    if (!extraIds.length) return active;

    const { data, error } = await this.client
      .from(T.shiftTypes)
      .select(`*, ${T.shiftTypeBreaks}(*)`)
      .eq("organization_id", organizationId)
      .in("id", extraIds)
      .order("sort_order");
    if (error) throw new Error(error.message);

    return [
      ...active,
      ...normalizeShiftTypesWithBreaks(data ?? []),
    ];
  }

  async seedDefaultShiftTypes(organizationId: string) {
    await seedDefaultShiftTypes(this.client, organizationId);
  }

  async getShiftTypeForAssign(shiftTypeId: string, organizationId: string) {
    const { data, error } = await this.client
      .from(T.shiftTypes)
      .select("id, start_time, end_time, organization_id")
      .eq("id", shiftTypeId)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .single();
    if (error || !data) return null;
    return data as Pick<ShiftType, "id" | "start_time" | "end_time">;
  }

  async getNextShiftTypeSortOrder(organizationId: string) {
    const { data } = await this.client
      .from(T.shiftTypes)
      .select("sort_order")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.sort_order as number) ?? -1) + 1;
  }

  async insertShiftType(row: {
    organization_id: string;
    name: string;
    start_time: string;
    end_time: string;
    color: string;
    sort_order: number;
  }) {
    const { data, error } = await this.client
      .from(T.shiftTypes)
      .insert({
        organization_id: row.organization_id,
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

  async updateShiftType(
    id: string,
    organizationId: string,
    row: { name: string; start_time: string; end_time: string }
  ) {
    const { error } = await this.client
      .from(T.shiftTypes)
      .update({
        name: row.name,
        start_time: normalizeTime(row.start_time),
        end_time: normalizeTime(row.end_time),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("archived_at", null);
    if (error) throw new Error(error.message);
  }

  async replaceShiftTypeBreaks(shiftTypeId: string, breaks: ShiftTypeBreakInput[]) {
    await replaceShiftTypeBreaks(this.client, shiftTypeId, breaks);
  }

  async countShiftsUsingType(shiftTypeId: string, organizationId: string) {
    const { count, error } = await this.client
      .from(T.shifts)
      .select("id", { count: "exact", head: true })
      .eq("shift_type_id", shiftTypeId)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async archiveShiftType(id: string, organizationId: string) {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(T.shiftTypes)
      .update({ archived_at: now })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async reorderShiftTypes(organizationId: string, orderedIds: string[]) {
    const existing = await this.listShiftTypes(organizationId);
    validateReorderPermutation(
      existing.map((entry) => entry.id),
      orderedIds
    );
    await applySortOrderBatch(
      orderedIds.map((id, index) =>
        this.client
          .from(T.shiftTypes)
          .update({ sort_order: index })
          .eq("id", id)
          .eq("organization_id", organizationId)
          .is("archived_at", null)
      )
    );
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
      throw new Error("Position nicht gefunden");
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
      .select("*, shift_types(name)")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .order("sort_order");
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) =>
      mapProfileRecurringAvailability(row as ProfileRecurringAvailabilityRow)
    );
  }

  async listOrganizationRecurringAvailability(organizationId: string) {
    const { data, error } = await this.client
      .from(T.profileRecurringAvailability)
      .select("*, shift_types(name)")
      .eq("organization_id", organizationId)
      .order("sort_order");
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) =>
      mapProfileRecurringAvailability(row as ProfileRecurringAvailabilityRow)
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

  private async resolveAvailabilityTimes(
    organizationId: string,
    input: {
      start_time: string;
      end_time: string;
      shift_type_id?: string | null;
    }
  ): Promise<
    | { ok: true; start_time: string; end_time: string; shift_type_id: string | null }
    | { ok: false; error: string }
  > {
    if (input.shift_type_id) {
      const { data, error } = await this.client
        .from(T.shiftTypes)
        .select("id, start_time, end_time, archived_at")
        .eq("id", input.shift_type_id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error || !data || data.archived_at != null) {
        return { ok: false, error: "Schichtart nicht gefunden." };
      }
      const parsed = parseAvailabilityTimeRange({
        start_time: data.start_time as string,
        end_time: data.end_time as string,
      });
      if (!parsed.ok) return parsed;
      return {
        ok: true,
        start_time: parsed.start_time,
        end_time: parsed.end_time,
        shift_type_id: input.shift_type_id,
      };
    }

    const parsed = parseAvailabilityTimeRange({
      start_time: input.start_time,
      end_time: input.end_time,
    });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      start_time: parsed.start_time,
      end_time: parsed.end_time,
      shift_type_id: null,
    };
  }

  async insertProfileRecurringAvailability(
    organizationId: string,
    profileId: string,
    input: {
      weekday: number;
      start_time: string;
      end_time: string;
      shift_type_id?: string | null;
    }
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const weekdayResult = parseAvailabilityWeekday(input.weekday);
    if (!weekdayResult.ok) throw new Error(weekdayResult.error);

    const times = await this.resolveAvailabilityTimes(organizationId, input);
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
        shift_type_id: times.shift_type_id,
        sort_order: sortOrder,
      })
      .select("*, shift_types(name)")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Speichern fehlgeschlagen");
    }
    return mapProfileRecurringAvailability(data as ProfileRecurringAvailabilityRow);
  }

  async updateProfileRecurringAvailability(
    organizationId: string,
    profileId: string,
    availabilityId: string,
    input: {
      weekday: number;
      start_time: string;
      end_time: string;
      shift_type_id?: string | null;
    }
  ) {
    const profile = await this.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      throw new Error("Profil nicht gefunden");
    }

    const weekdayResult = parseAvailabilityWeekday(input.weekday);
    if (!weekdayResult.ok) throw new Error(weekdayResult.error);

    const times = await this.resolveAvailabilityTimes(organizationId, input);
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
        shift_type_id: times.shift_type_id,
      })
      .eq("id", availabilityId)
      .eq("profile_id", profileId)
      .eq("organization_id", organizationId)
      .select("*, shift_types(name)")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Speichern fehlgeschlagen");
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
      .order("valid_from", { ascending: false })
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

    const { data: openRate, error: openError } = await this.client
      .from(T.profileHourlyRates)
      .select("id, valid_from")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .is("valid_to", null)
      .maybeSingle();
    if (openError) throw new Error(openError.message);

    if (openRate && input.valid_from <= (openRate.valid_from as string).slice(0, 10)) {
      throw new Error("Das Gültig-ab-Datum muss nach dem aktuellen Satz liegen.");
    }

    if (openRate) {
      const { error: closeError } = await this.client
        .from(T.profileHourlyRates)
        .update({ valid_to: dayBefore(input.valid_from) })
        .eq("id", openRate.id as string)
        .eq("organization_id", organizationId);
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
        valid_to: null,
        created_by: input.created_by,
      })
      .select(PROFILE_HOURLY_RATE_SELECT)
      .single();
    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "Stundensatz konnte nicht gespeichert werden");
    }
    return mapProfileHourlyRate(inserted as ProfileHourlyRateRow);
  }

  async updateProfileHourlyRate(
    organizationId: string,
    profileId: string,
    rateId: string,
    input: {
      amount: number;
      valid_from: string;
    },
    referenceDate: string
  ) {
    const rate = await this.getProfileHourlyRateById(
      organizationId,
      profileId,
      rateId
    );
    if (!rate) {
      throw new Error("Stundensatz nicht gefunden");
    }
    if (!isMutableHourlyRate(rate.valid_from, referenceDate)) {
      throw new Error(
        "Nur Entgelte mit Gültig-ab ab heute können geändert oder gelöscht werden."
      );
    }

    const validFromCheck = validateMutableHourlyRateValidFrom(
      input.valid_from,
      referenceDate
    );
    if (!validFromCheck.ok) throw new Error(validFromCheck.error);

    const successor = await this.findSuccessorProfileHourlyRate(
      organizationId,
      profileId,
      rate.valid_from
    );
    if (successor && input.valid_from >= successor.valid_from.slice(0, 10)) {
      throw new Error("Das Gültig-ab-Datum muss vor dem nächsten Satz liegen.");
    }

    if (input.valid_from !== rate.valid_from) {
      const predecessor = await this.findPredecessorProfileHourlyRate(
        organizationId,
        profileId,
        rate.valid_from
      );
      if (predecessor) {
        const { error: predError } = await this.client
          .from(T.profileHourlyRates)
          .update({ valid_to: dayBefore(input.valid_from) })
          .eq("id", predecessor.id)
          .eq("organization_id", organizationId);
        if (predError) throw new Error(predError.message);
      }
    }

    const { data: updated, error: updateError } = await this.client
      .from(T.profileHourlyRates)
      .update({
        amount: input.amount,
        valid_from: input.valid_from,
      })
      .eq("id", rateId)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .select(PROFILE_HOURLY_RATE_SELECT)
      .single();
    if (updateError || !updated) {
      throw new Error(
        updateError?.message ?? "Stundensatz konnte nicht aktualisiert werden"
      );
    }
    return mapProfileHourlyRate(updated as ProfileHourlyRateRow);
  }

  async deleteProfileHourlyRate(
    organizationId: string,
    profileId: string,
    rateId: string,
    referenceDate: string
  ) {
    const rate = await this.getProfileHourlyRateById(
      organizationId,
      profileId,
      rateId
    );
    if (!rate) {
      throw new Error("Stundensatz nicht gefunden");
    }
    if (!isMutableHourlyRate(rate.valid_from, referenceDate)) {
      throw new Error(
        "Nur Entgelte mit Gültig-ab ab heute können geändert oder gelöscht werden."
      );
    }

    const predecessor = await this.findPredecessorProfileHourlyRate(
      organizationId,
      profileId,
      rate.valid_from
    );
    const successor = await this.findSuccessorProfileHourlyRate(
      organizationId,
      profileId,
      rate.valid_from
    );

    const { error: deleteError } = await this.client
      .from(T.profileHourlyRates)
      .delete()
      .eq("id", rateId)
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId);
    if (deleteError) throw new Error(deleteError.message);

    if (predecessor) {
      const nextValidTo = successor
        ? dayBefore(successor.valid_from.slice(0, 10))
        : null;
      const { error: predError } = await this.client
        .from(T.profileHourlyRates)
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

  async listLocationsForDashboard(
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

  async listLocationAreasForDashboard(
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
  }) {
    const { data, error } = await this.client
      .from(T.locationAreas)
      .insert({
        location_id: row.location_id,
        name: row.name,
        sort_order: row.sort_order,
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
    row: { name: string }
  ) {
    const { error } = await this.client
      .from(T.locationAreas)
      .update({ name: row.name })
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
        "id, location_area_id, shift_type_id, qualification_id, weekday, required_count"
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
        "id, location_area_id, shift_type_id, qualification_id, weekday, required_count"
      )
      .eq("location_area_id", locationAreaId);
    if (error) throw new Error(error.message);
    return (data ?? []) as LocationAreaStaffing[];
  }

  async replaceLocationAreaStaffing(
    locationAreaId: string,
    locationId: string,
    rules: {
      shift_type_id: string;
      weekday: number;
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
        shift_type_id: r.shift_type_id,
        qualification_id: r.qualification_id,
        weekday: r.weekday,
        required_count: r.required_count,
      }))
    );
    if (insError) throw new Error(insError.message);
  }

  async saveLocationAreaStaffingForShiftType(
    locationAreaId: string,
    locationId: string,
    shiftTypeId: string,
    rules: {
      weekday: number;
      qualification_id: string;
      required_count: number;
    }[]
  ) {
    const areas = await this.listLocationAreas(locationId);
    if (!areas.some((a) => a.id === locationAreaId)) {
      throw new Error("Bereich nicht gefunden");
    }

    const toInsert = rules.filter((r) => r.required_count > 0);
    const { error } = await this.client.rpc(
      "replace_location_area_staffing_for_shift_type",
      {
        p_location_area_id: locationAreaId,
        p_shift_type_id: shiftTypeId,
        p_rules: toInsert,
      }
    );
    if (error) throw new Error(error.message);
  }

  async removeLocationAreaStaffingForShiftType(
    locationAreaId: string,
    locationId: string,
    shiftTypeId: string
  ) {
    const areas = await this.listLocationAreas(locationId);
    if (!areas.some((a) => a.id === locationAreaId)) {
      throw new Error("Bereich nicht gefunden");
    }

    const { error } = await this.client
      .from(T.locationAreaStaffing)
      .delete()
      .eq("location_area_id", locationAreaId)
      .eq("shift_type_id", shiftTypeId);
    if (error) throw new Error(error.message);
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
      .in("location_area_id", areaIds);
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
      .order("weekday");
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

  async listMyShifts(fromDate: string, toDate: string) {
    const { data, error } = await this.client
      .from(T.shifts)
      .select("*")
      .gte("shift_date", fromDate)
      .lte("shift_date", toDate)
      .order("shift_date", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as Shift[];
  }

  async listShiftsForWeek(organizationId: string, from: string, to: string) {
    const { data } = await this.client
      .from(T.shifts)
      .select("*, shift_types(name, color, start_time, end_time)")
      .eq("organization_id", organizationId)
      .gte("shift_date", from)
      .lte("shift_date", to);
    return (data ?? []) as ShiftWithTypeRow[];
  }

  async listDashboardShifts(
    organizationId: string,
    from: string,
    to: string,
    locationId: string
  ) {
    const { data } = await this.client
      .from(T.shifts)
      .select(
        `id, employee_id, location_area_id, shift_type_id, shift_date, starts_at, ends_at, shift_types(name, color, start_time, end_time), profiles!employee_id(full_name, color)`
      )
      .eq("organization_id", organizationId)
      .eq("location_id", locationId)
      .gte("shift_date", from)
      .lte("shift_date", to)
      .order("shift_date");
    return (data ?? []) as unknown as DashboardShiftRow[];
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

  async findShiftByEmployeeDate(employeeId: string, shiftDate: string) {
    const { data } = await this.client
      .from(T.shifts)
      .select("id, location_id")
      .eq("employee_id", employeeId)
      .eq("shift_date", shiftDate)
      .limit(1)
      .maybeSingle();
    return data
      ? {
          id: data.id as string,
          location_id: (data.location_id as string | null) ?? null,
        }
      : null;
  }

  async listShiftsForEmployeeDate(employeeId: string, shiftDate: string) {
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, employee_id, shift_type_id, location_id, location_area_id, shift_date, starts_at, ends_at, created_by"
      )
      .eq("employee_id", employeeId)
      .eq("shift_date", shiftDate)
      .order("starts_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeeShiftRecord[];
  }

  async getShiftRecordById(id: string, organizationId: string) {
    const { data, error } = await this.client
      .from(T.shifts)
      .select(
        "id, employee_id, shift_type_id, location_id, location_area_id, shift_date, starts_at, ends_at, created_by"
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
    shift_type_id: string | null;
    location_id: string;
    location_area_id?: string | null;
    shift_date: string;
    starts_at: string;
    ends_at: string;
    created_by: string;
  }) {
    const { data, error } = await this.client
      .from(T.shifts)
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id as string };
  }

  async updateShift(
    id: string,
    row: {
      shift_type_id: string | null;
      location_id: string;
      location_area_id?: string | null;
      starts_at: string;
      ends_at: string;
      created_by: string;
    }
  ) {
    const { error } = await this.client.from(T.shifts).update(row).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async deleteShift(id: string, organizationId: string) {
    const { error } = await this.client
      .from(T.shifts)
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  async listAvailabilityForWeek(organizationId: string, from: string, to: string) {
    const { data } = await this.client
      .from(T.availability)
      .select("employee_id, available_date, status")
      .eq("organization_id", organizationId)
      .gte("available_date", from)
      .lte("available_date", to);
    return (data ?? []) as AvailabilityRow[];
  }

  async listOrganizationAbsences(
    organizationId: string,
    status: "approved" | "pending" | "rejected" | "cancelled" = "approved"
  ) {
    const { data, error } = await this.client
      .from(T.absenceRequests)
      .select(
        "id, organization_id, employee_id, type, start_date, end_date, status, notes, reviewed_by"
      )
      .eq("organization_id", organizationId)
      .eq("status", status)
      .order("start_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AbsenceRequest[];
  }

  async insertAbsenceRequest(row: {
    organization_id: string;
    employee_id: string;
    type: AbsenceType;
    start_date: string;
    end_date: string;
    status: "approved";
    notes: string | null;
    reviewed_by: string;
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
      end_date: string;
      status: "approved";
      notes: string | null;
      reviewed_by: string;
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

  async countShiftsConflictingWithAbsenceRanges(
    organizationId: string,
    ranges: { employee_id: string; start_date: string; end_date: string }[]
  ) {
    if (!ranges.length) return 0;

    const employeeIds = [...new Set(ranges.map((range) => range.employee_id))];
    let minDate = ranges[0]!.start_date;
    let maxDate = ranges[0]!.end_date;
    for (const range of ranges) {
      if (range.start_date < minDate) minDate = range.start_date;
      if (range.end_date > maxDate) maxDate = range.end_date;
    }

    const { data, error } = await this.client
      .from(T.shifts)
      .select("employee_id, shift_date")
      .eq("organization_id", organizationId)
      .in("employee_id", employeeIds)
      .gte("shift_date", minDate)
      .lte("shift_date", maxDate);
    if (error) throw new Error(error.message);

    let count = 0;
    for (const row of data ?? []) {
      const employeeId = row.employee_id as string;
      const shiftDate = row.shift_date as string;
      const matches = ranges.some(
        (range) =>
          range.employee_id === employeeId &&
          isDateWithinAbsenceRange(range, shiftDate)
      );
      if (matches) count += 1;
    }
    return count;
  }

  async getManagerProfile(userId: string) {
    return this.getProfileById(userId);
  }
}

/** Factory: Supabase-Adapter (aktueller Standard). */
export function createDatabase(client: SupabaseClient): SchichtwerkDatabase {
  return new SupabaseSchichtwerkDatabase(client);
}
