"use server";

import {
  filterEmployeesAvailableOnWeekday,
  filterEmployeesNotAbsentOnDate,
  profileAvailabilityWeekdayFromDashboardDate,
} from "@/lib/available-employees-for-shift";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type DashboardEmployeeAvailabilityEntry = {
  weekday: number;
  start_time: string;
  end_time: string;
};

export type DashboardShiftAssignEmployee = {
  id: string;
  full_name: string;
  color: string | null;
  last_shift_date: string | null;
  availabilities: DashboardEmployeeAvailabilityEntry[];
};

export type FetchDashboardShiftAssignEmployeesResult =
  | { ok: true; employees: DashboardShiftAssignEmployee[] }
  | { ok: false; error: string };

export type FetchDashboardBulkShiftContextResult =
  | {
      ok: true;
      employees: DashboardShiftAssignEmployee[];
      profileQualificationIds: Record<string, string[]>;
    }
  | { ok: false; error: string };

export async function fetchDashboardBulkShiftContext(
  date: string
): Promise<FetchDashboardBulkShiftContextResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const employeeResult = await fetchDashboardShiftAssignEmployees(date);
    if (!employeeResult.ok) {
      return employeeResult;
    }

    const qualificationMap =
      await db.listProfileQualificationIdsByOrganization(organizationId);
    const profileQualificationIds: Record<string, string[]> = {};
    for (const [profileId, ids] of qualificationMap.entries()) {
      profileQualificationIds[profileId] = ids;
    }

    return {
      ok: true,
      employees: employeeResult.employees,
      profileQualificationIds,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function fetchDashboardShiftAssignEmployees(
  date: string
): Promise<FetchDashboardShiftAssignEmployeesResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const weekday = profileAvailabilityWeekdayFromDashboardDate(date);

    const [profiles, availability, lastShiftDates, absences] = await Promise.all([
      db.listOrganizationProfiles(organizationId),
      db.listOrganizationRecurringAvailability(organizationId),
      db.listEmployeeLastShiftDates(organizationId),
      db.listOrganizationAbsences(organizationId, "approved"),
    ]);

    const dayAvailable = filterEmployeesNotAbsentOnDate(
      filterEmployeesAvailableOnWeekday(profiles, availability, weekday),
      absences,
      date
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
