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
  resolveOrganizationTimeZone,
  serviceWeekdayForShiftDate,
} from "@schichtwerk/database";

export type ProfileShiftPreferenceEntry = {
  weekday: number;
  start_time: string;
  end_time: string;
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
  last_shift_date: string | null;
  availabilities: AreaCalendarEmployeeAvailabilityEntry[];
};

export type FetchAreaCalendarShiftAssignEmployeesResult =
  | { ok: true; employees: AreaCalendarShiftAssignEmployee[] }
  | { ok: false; error: string };

export type FetchAreaCalendarBulkShiftContextResult =
  | {
      ok: true;
      employees: AreaCalendarShiftAssignEmployee[];
      profileQualificationIds: Record<string, string[]>;
      profileShiftPreferences: Record<string, ProfileShiftPreferenceEntry[]>;
      countryCode: string;
      timeZone: string;
    }
  | { ok: false; error: string };

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
      ok: true,
      employees: employeeResult.employees,
      profileQualificationIds,
      profileShiftPreferences,
      countryCode,
      timeZone,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function fetchAreaCalendarShiftAssignEmployees(
  date: string,
  options?: {
    simulatedProposedOnAssign?: boolean;
    relaxAppRegistrationGate?: boolean;
  }
): Promise<FetchAreaCalendarShiftAssignEmployeesResult> {
  try {
    const { organizationId, organization, profile } = await requireManager();
    const assignMode = resolveSimulatedProposedAssignOptions({
      organizationEnabled: organization.shift_confirmation_enabled,
      simulatedProposedOnAssign: options?.simulatedProposedOnAssign,
      relaxAppRegistrationGate: options?.relaxAppRegistrationGate,
      managerEmail: profile.email,
    });
    const db = await getDatabase();
    const weekday = profileAvailabilityWeekdayFromAreaCalendarDate(date);

    const [profiles, availability, lastShiftDates, absences] = await Promise.all([
      db.listPlanningEmployees(organizationId),
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
        .map((profile) => ({
          id: profile.id,
          full_name: profile.full_name,
          color: profile.color,
          last_shift_date: lastShiftDates[profile.id] ?? null,
          availabilities: (availabilityByProfile.get(profile.id) ?? [])
            .slice()
            .sort(
              (a, b) => a.weekday - b.weekday || a.sort_order - b.sort_order
            )
            .map((slot) => ({
              weekday: slot.weekday,
              start_time: slot.start_time,
              end_time: slot.end_time,
            })),
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "de")),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}
