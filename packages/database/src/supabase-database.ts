import type {
  Location,
  LocationArea,
  LocationAreaStaffing,
  Profile,
  Qualification,
  Shift,
  ShiftType,
  ShiftTypeWithBreaks,
  UserRole,
} from "@schichtwerk/types";
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
  dedupeShiftTypes,
  normalizeShiftTypesWithBreaks,
  normalizeTime,
  replaceShiftTypeBreaks,
  seedDefaultLocationAreas,
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

  async archiveQualification(id: string, organizationId: string) {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(T.qualifications)
      .update({ archived_at: now })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
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
    active_weekdays: string;
    on_holiday_open: boolean;
    sort_order: number;
  }) {
    const { data, error } = await this.client
      .from(T.locations)
      .insert({
        organization_id: row.organization_id,
        name: row.name,
        active_weekdays: row.active_weekdays,
        on_holiday_open: row.on_holiday_open,
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
    return { id: data.id as string };
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

  async archiveLocationArea(id: string, locationId: string) {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(T.locationAreas)
      .update({ archived_at: now })
      .eq("id", id)
      .eq("location_id", locationId);
    if (error) throw new Error(error.message);
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
      .select("id, location_area_id, shift_type_id, weekday, required_count")
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
      .select("id, location_area_id, shift_type_id, weekday, required_count")
      .eq("location_area_id", locationAreaId);
    if (error) throw new Error(error.message);
    return (data ?? []) as LocationAreaStaffing[];
  }

  async replaceLocationAreaStaffing(
    locationAreaId: string,
    locationId: string,
    rules: { shift_type_id: string; weekday: number; required_count: number }[]
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
        weekday: r.weekday,
        required_count: r.required_count,
      }))
    );
    if (insError) throw new Error(insError.message);
  }

  async updateLocation(
    id: string,
    organizationId: string,
    row: {
      name: string;
      active_weekdays: string;
      on_holiday_open: boolean;
    }
  ) {
    const { error } = await this.client
      .from(T.locations)
      .update({
        name: row.name,
        active_weekdays: row.active_weekdays,
        on_holiday_open: row.on_holiday_open,
      })
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

  async listDashboardShifts(
    organizationId: string,
    from: string,
    to: string,
    locationId: string
  ) {
    const { data } = await this.client
      .from(T.shifts)
      .select(
        `id, employee_id, location_area_id, shift_date, shift_types(name, color, start_time, end_time), profiles!employee_id(full_name)`
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
      .maybeSingle();
    return data
      ? {
          id: data.id as string,
          location_id: (data.location_id as string | null) ?? null,
        }
      : null;
  }

  async insertShift(row: {
    organization_id: string;
    employee_id: string;
    shift_type_id: string;
    location_id: string;
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
      location_id: string;
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
