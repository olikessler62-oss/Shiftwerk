"use server";

import {
  filterEmployeesAvailableOnWeekday,
  filterEmployeesNotAbsentOnDate,
  filterProfilesForShiftAssignment,
  filterProfilesForShiftConfirmationAssign,
  profileAvailabilityWeekdayFromAreaCalendarDate,
} from "@/lib/available-employees-for-shift";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import { resolveSimulatedProposedAssignOptions } from "@/lib/shift-confirmation-assign-mode";
import {
  DEFAULT_COUNTRY_CODE,
  isoWeekEndFromWeekStart,
  isoWeekStartFromShiftDate,
  resolveOrganizationTimeZone,
  serviceWeekdayForShiftDate,
} from "@schichtwerk/database";
import type { AbsenceType, Profile } from "@schichtwerk/types";
import { shiftTimeFromTimestamp } from "@/lib/dates";
import {
  resolveEmployeeAbsenceTypeOnDate,
  type DashboardStaffingCandidateEmployeeTooltipPayload,
} from "@/lib/dashboard-staffing-candidate-employee-tooltip";

export type ProfileShiftPreferenceEntry = {
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  location_id: string | null;
  location_area_id: string | null;
  qualification_id: string | null;
  priority: number;
};

export type AreaCalendarEmployeeAvailabilityEntry = {
  weekday: number;
  start_time: string;
  end_time: string;
};

export type AreaCalendarShiftAssignEmployee = {
  id: string;
  full_name: string;
  color: string | null;
  weekly_hours: number | null;
  last_shift_date: string | null;
  availabilities: AreaCalendarEmployeeAvailabilityEntry[];
};

export type FetchAreaCalendarShiftAssignEmployeesResult =
  | { ok: true; employees: AreaCalendarShiftAssignEmployee[] }
  | { ok: false; error: string };

export type OrganizationWeekShiftRef = {
  id: string;
  employee_id: string;
  shift_date: string;
  startTime: string;
  endTime: string;
  location_id: string | null;
  location_area_id: string | null;
  area_shift_template_id: string | null;
};

export type FetchAreaCalendarBulkShiftContextResult =
  | {
      ok: true;
      employees: AreaCalendarShiftAssignEmployee[];
      profileQualificationIds: Record<string, string[]>;
      profileShiftPreferences: Record<string, ProfileShiftPreferenceEntry[]>;
      countryCode: string;
      timeZone: string;
      locations: { id: string; name: string }[];
      organizationWeekShifts?: OrganizationWeekShiftRef[];
    }
  | { ok: false; error: string };

export type FetchDashboardStaffingCandidateContextResult =
  FetchAreaCalendarBulkShiftContextResult;

export type FetchDashboardStaffingCandidateEmployeeTooltipResult =
  | { ok: true; data: DashboardStaffingCandidateEmployeeTooltipPayload }
  | { ok: false; error: string };

async function mapShiftAssignEmployeesForDate(
  organizationId: string,
  date: string,
  profiles: readonly Profile[],
  options?: {
    simulatedProposedOnAssign?: boolean;
    relaxAppRegistrationGate?: boolean;
  }
): Promise<FetchAreaCalendarShiftAssignEmployeesResult> {
  const { organization, profile } = await requireManager();
  const assignMode = resolveSimulatedProposedAssignOptions({
    organizationEnabled: organization.shift_confirmation_enabled,
    simulatedProposedOnAssign: options?.simulatedProposedOnAssign,
    relaxAppRegistrationGate: options?.relaxAppRegistrationGate,
    managerEmail: profile.email,
  });
  const db = await getDatabase();
  const weekday = profileAvailabilityWeekdayFromAreaCalendarDate(date);

  const [availability, lastShiftDates, absences] = await Promise.all([
    db.listOrganizationRecurringAvailability(organizationId),
    db.listEmployeeLastShiftDates(organizationId),
    db.listOrganizationAbsences(organizationId, { statuses: ["approved"] }),
  ]);

  const schedulableProfiles = filterProfilesForShiftAssignment(
    profiles,
    organizationId
  );

  const dayAvailable = filterProfilesForShiftConfirmationAssign(
    filterEmployeesNotAbsentOnDate(
      filterEmployeesAvailableOnWeekday(
        schedulableProfiles,
        availability,
        weekday,
        organizationId
      ),
      absences,
      date
    ),
    assignMode.shiftConfirmationEnabled,
    assignMode.relaxAppRegistrationGate
  );

  const availabilityByProfile = new Map<string, typeof availability>();
  for (const slot of availability) {
    const list = availabilityByProfile.get(slot.profile_id) ?? [];
    list.push(slot);
    availabilityByProfile.set(slot.profile_id, list);
  }

  return {
    ok: true,
    employees: dayAvailable
      .map((profileRow) => ({
        id: profileRow.id,
        full_name: profileRow.full_name,
        color: profileRow.color,
        weekly_hours: profileRow.weekly_hours,
        last_shift_date: lastShiftDates[profileRow.id] ?? null,
        availabilities: (availabilityByProfile.get(profileRow.id) ?? [])
          .slice()
          .sort((a, b) => a.weekday - b.weekday || a.sort_order - b.sort_order)
          .map((slot) => ({
            weekday: slot.weekday,
            start_time: slot.start_time,
            end_time: slot.end_time,
          })),
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "de")),
  };
}

async function fetchShiftAssignBulkMetadata(
  organizationId: string,
  date: string
): Promise<{
  profileQualificationIds: Record<string, string[]>;
  profileShiftPreferences: Record<string, ProfileShiftPreferenceEntry[]>;
  countryCode: string;
  timeZone: string;
}> {
  const { organization } = await requireManager();
  const db = await getDatabase();

  const qualificationMap =
    await db.listProfileQualificationIdsByOrganization(organizationId);
  const profileQualificationIds: Record<string, string[]> = {};
  for (const [profileId, ids] of qualificationMap.entries()) {
    profileQualificationIds[profileId] = ids;
  }

  const countryCode =
    (await db.getOrganizationCountryCode(organizationId)) ?? DEFAULT_COUNTRY_CODE;
  const timeZone = resolveOrganizationTimeZone(organization);
  const weekday = serviceWeekdayForShiftDate(countryCode, date);
  const shiftPreferences = await db.listOrganizationShiftPreferences(
    organizationId,
    weekday
  );
  const profileShiftPreferences: Record<string, ProfileShiftPreferenceEntry[]> =
    {};
  for (const preference of shiftPreferences) {
    const list = profileShiftPreferences[preference.profile_id] ?? [];
    list.push({
      weekday: preference.weekday,
      start_time: preference.start_time,
      end_time: preference.end_time,
      location_id: preference.location_id,
      location_area_id: preference.location_area_id,
      qualification_id: preference.qualification_id,
      priority: preference.priority,
    });
    profileShiftPreferences[preference.profile_id] = list;
  }

  return {
    profileQualificationIds,
    profileShiftPreferences,
    countryCode,
    timeZone,
  };
}

export async function fetchAreaCalendarBulkShiftContext(
  date: string,
  options?: {
    simulatedProposedOnAssign?: boolean;
    relaxAppRegistrationGate?: boolean;
  }
): Promise<FetchAreaCalendarBulkShiftContextResult> {
  try {
    const { organizationId, organization } = await requireManager();
    const db = await getDatabase();

    const employeeResult = await fetchAreaCalendarShiftAssignEmployees(
      date,
      options
    );
    if (!employeeResult.ok) {
      return employeeResult;
    }

    const metadata = await fetchShiftAssignBulkMetadata(organizationId, date);
    const timeZone = resolveOrganizationTimeZone(organization);
    const weekStart = isoWeekStartFromShiftDate(date);
    const weekEnd = isoWeekEndFromWeekStart(weekStart);
    const [organizationShiftRows, locations] = await Promise.all([
      db.listOrganizationShiftsInDateRange(organizationId, weekStart, weekEnd),
      db.listLocations(organizationId),
    ]);
    const organizationWeekShifts: OrganizationWeekShiftRef[] =
      organizationShiftRows.map((shift) => ({
        id: shift.id,
        employee_id: shift.employee_id,
        shift_date: shift.shift_date,
        startTime: shiftTimeFromTimestamp(shift.starts_at, timeZone),
        endTime: shiftTimeFromTimestamp(shift.ends_at, timeZone),
        location_id: shift.location_id,
        location_area_id: shift.location_area_id,
        area_shift_template_id: shift.area_shift_template_id,
      }));

    return {
      ok: true,
      employees: employeeResult.employees,
      ...metadata,
      locations: locations.map((location) => ({
        id: location.id,
        name: location.name,
      })),
      organizationWeekShifts,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function fetchDashboardStaffingCandidateContext(
  date: string,
  options?: {
    simulatedProposedOnAssign?: boolean;
    relaxAppRegistrationGate?: boolean;
  }
): Promise<FetchDashboardStaffingCandidateContextResult> {
  try {
    const { organizationId, organization } = await requireManager();
    const db = await getDatabase();

    const profiles = await db.listOrganizationProfiles(organizationId);
    const employeeResult = await mapShiftAssignEmployeesForDate(
      organizationId,
      date,
      profiles,
      options
    );
    if (!employeeResult.ok) {
      return employeeResult;
    }

    const metadata = await fetchShiftAssignBulkMetadata(organizationId, date);
    const timeZone = resolveOrganizationTimeZone(organization);
    const weekStart = isoWeekStartFromShiftDate(date);
    const weekEnd = isoWeekEndFromWeekStart(weekStart);
    const [organizationShiftRows, locations] = await Promise.all([
      db.listOrganizationShiftsInDateRange(organizationId, weekStart, weekEnd),
      db.listLocations(organizationId),
    ]);
    const organizationWeekShifts: OrganizationWeekShiftRef[] =
      organizationShiftRows.map((shift) => ({
        id: shift.id,
        employee_id: shift.employee_id,
        shift_date: shift.shift_date,
        startTime: shiftTimeFromTimestamp(shift.starts_at, timeZone),
        endTime: shiftTimeFromTimestamp(shift.ends_at, timeZone),
        location_id: shift.location_id,
        location_area_id: shift.location_area_id,
        area_shift_template_id: shift.area_shift_template_id,
      }));

    return {
      ok: true,
      employees: employeeResult.employees,
      ...metadata,
      locations: locations.map((location) => ({
        id: location.id,
        name: location.name,
      })),
      organizationWeekShifts,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function fetchDashboardStaffingCandidateEmployeeTooltip(
  employeeId: string,
  contextDateISO: string,
  todayISO: string
): Promise<FetchDashboardStaffingCandidateEmployeeTooltipResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(employeeId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Personal nicht gefunden" };
    }

    const [absences, availability, qualificationMap, shiftPreferences, locations, adjacentAssignments] =
      await Promise.all([
        db.listOrganizationAbsences(organizationId, { statuses: ["approved"] }),
        db.listOrganizationRecurringAvailability(organizationId),
        db.listProfileQualificationIdsByOrganization(organizationId),
        db.listAllOrganizationShiftPreferences(organizationId),
        db.listLocations(organizationId),
        db.getEmployeeAdjacentShiftAssignments(
          organizationId,
          employeeId,
          new Date().toISOString()
        ),
      ]);

    const areasNested = await Promise.all(
      locations.map((location) => db.listLocationAreas(location.id))
    );
    const areas = areasNested.flat();

    const employeeAvailability = availability
      .filter((slot) => slot.profile_id === employeeId)
      .map((slot) => ({
        weekday: slot.weekday,
        start_time: slot.start_time,
        end_time: slot.end_time,
      }));

    const employeePreferences: ProfileShiftPreferenceEntry[] = shiftPreferences
      .filter((preference) => preference.profile_id === employeeId)
      .map((preference) => ({
        weekday: preference.weekday,
        start_time: preference.start_time,
        end_time: preference.end_time,
        location_id: preference.location_id,
        location_area_id: preference.location_area_id,
        qualification_id: preference.qualification_id,
        priority: preference.priority,
      }));

    const absenceType: AbsenceType | null = resolveEmployeeAbsenceTypeOnDate(
      employeeId,
      contextDateISO,
      absences
    );

    return {
      ok: true,
      data: {
        schedulable: profile.schedulable,
        isActive: profile.is_active,
        absenceType,
        availability: employeeAvailability,
        qualificationIds: qualificationMap.get(employeeId) ?? [],
        shiftPreferences: employeePreferences,
        locations: locations.map((location) => ({
          id: location.id,
          name: location.name,
        })),
        areas: areas.map((area) => ({
          id: area.id,
          name: area.name,
          location_id: area.location_id,
        })),
        adjacentAssignments,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export const fetchPlanningEmployeeTooltip =
  fetchDashboardStaffingCandidateEmployeeTooltip;

export async function fetchAreaCalendarShiftAssignEmployees(
  date: string,
  options?: {
    simulatedProposedOnAssign?: boolean;
    relaxAppRegistrationGate?: boolean;
  }
): Promise<FetchAreaCalendarShiftAssignEmployeesResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profiles = await db.listPlanningEmployees(organizationId);
    return mapShiftAssignEmployeesForDate(
      organizationId,
      date,
      profiles,
      options
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}
