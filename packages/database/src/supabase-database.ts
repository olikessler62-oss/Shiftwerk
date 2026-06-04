import type { Profile, Shift, ShiftType, UserRole } from "@schichtwerk/types";
import type { Session } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Schema } from "./schema";
import type {
  AuthSignUpResult,
  AvailabilityRow,
  DashboardShiftRow,
  InviteUserResult,
  SchichtwerkDatabase,
  ShiftTypeBreakInput,
  ShiftWithTypeRow,
} from "./interface";
import {
  normalizeShiftTypesWithBreaks,
  normalizeTime,
  replaceShiftTypeBreaks,
  seedDefaultShiftTypes,
} from "./utils";

const T = Schema.tables;

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

  async getCurrentUserProfile() {
    const user = await this.authGetUser();
    if (!user) return null;
    return this.getProfileById(user.id);
  }

  async getProfileById(id: string) {
    const { data, error } = await this.client
      .from(T.profiles)
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return data as Profile;
  }

  async getProfileRole(id: string) {
    const { data } = await this.client
      .from(T.profiles)
      .select("role")
      .eq("id", id)
      .single();
    return (data?.role as UserRole) ?? null;
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
    role: UserRole;
    full_name: string;
    email: string;
  }) {
    const { error } = await this.client.from(T.profiles).insert(row);
    if (error) throw new Error(error.message);
  }

  async listActiveEmployees(organizationId: string) {
    const { data } = await this.client
      .from(T.profiles)
      .select("*")
      .eq("organization_id", organizationId)
      .eq("role", "employee")
      .eq("is_active", true)
      .order("full_name");
    return (data ?? []) as Profile[];
  }

  async countActiveEmployees(organizationId: string) {
    const { count } = await this.client
      .from(T.profiles)
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("role", "employee")
      .eq("is_active", true);
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
      .eq("organization_id", organizationId)
      .eq("role", "employee");
    if (error) throw new Error(error.message);
  }

  async listShiftTypes(organizationId: string) {
    const { data } = await this.client
      .from(T.shiftTypes)
      .select("*")
      .eq("organization_id", organizationId)
      .order("sort_order");
    return (data ?? []) as ShiftType[];
  }

  async loadShiftTypesWithBreaks(organizationId: string) {
    let { data } = await this.client
      .from(T.shiftTypes)
      .select(`*, ${T.shiftTypeBreaks}(*)`)
      .eq("organization_id", organizationId)
      .order("sort_order");

    if (!data?.length) {
      await seedDefaultShiftTypes(this.client, organizationId);
      const res = await this.client
        .from(T.shiftTypes)
        .select(`*, ${T.shiftTypeBreaks}(*)`)
        .eq("organization_id", organizationId)
        .order("sort_order");
      data = res.data;
    }

    return normalizeShiftTypesWithBreaks(data ?? []);
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
      .single();
    if (error || !data) return null;
    return data as Pick<ShiftType, "id" | "start_time" | "end_time">;
  }

  async getNextShiftTypeSortOrder(organizationId: string) {
    const { data } = await this.client
      .from(T.shiftTypes)
      .select("sort_order")
      .eq("organization_id", organizationId)
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
      .eq("organization_id", organizationId);
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

  async deleteShiftType(id: string, organizationId: string) {
    const { error } = await this.client
      .from(T.shiftTypes)
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
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

  async listDashboardShifts(organizationId: string, from: string, to: string) {
    const { data } = await this.client
      .from(T.shifts)
      .select(
        `id, employee_id, shift_date, shift_types(name, color, start_time, end_time), profiles!employee_id(full_name)`
      )
      .eq("organization_id", organizationId)
      .gte("shift_date", from)
      .lte("shift_date", to)
      .order("shift_date");
    return (data ?? []) as unknown as DashboardShiftRow[];
  }

  async findShiftByEmployeeDate(employeeId: string, shiftDate: string) {
    const { data } = await this.client
      .from(T.shifts)
      .select("id")
      .eq("employee_id", employeeId)
      .eq("shift_date", shiftDate)
      .maybeSingle();
    return data ? { id: data.id as string } : null;
  }

  async insertShift(row: {
    organization_id: string;
    employee_id: string;
    shift_type_id: string;
    shift_date: string;
    starts_at: string;
    ends_at: string;
    created_by: string;
  }) {
    const { error } = await this.client.from(T.shifts).insert(row);
    if (error) throw new Error(error.message);
  }

  async updateShift(
    id: string,
    row: {
      shift_type_id: string;
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

  async getManagerProfile(userId: string) {
    return this.getProfileById(userId);
  }
}

/** Factory: Supabase-Adapter (aktueller Standard). */
export function createDatabase(client: SupabaseClient): SchichtwerkDatabase {
  return new SupabaseSchichtwerkDatabase(client);
}
