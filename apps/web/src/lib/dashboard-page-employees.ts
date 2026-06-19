import type { Profile } from "@schichtwerk/types";

type ShiftEmployeeRef = {
  employee_id: string;
};

export function compareProfilesForPlanning(a: Profile, b: Profile): number {
  const orderDiff = a.sort_order - b.sort_order;
  if (orderDiff !== 0) return orderDiff;
  return a.full_name.localeCompare(b.full_name, "de");
}

/** Schichtplan-Zeilen: planbare Profile plus bereits eingeteilte (z. B. nach Abwahl von schedulable). */
export async function resolveDashboardEmployeesForShifts(
  planningEmployees: readonly Profile[],
  shifts: readonly ShiftEmployeeRef[],
  fetchProfileById: (id: string) => Promise<Profile | null>,
  organizationId: string
): Promise<Profile[]> {
  const byId = new Map(planningEmployees.map((employee) => [employee.id, employee]));
  const missingIds = [
    ...new Set(shifts.map((shift) => shift.employee_id)),
  ].filter((id) => !byId.has(id));

  if (missingIds.length > 0) {
    const profiles = await Promise.all(missingIds.map(fetchProfileById));
    for (const profile of profiles) {
      if (
        profile &&
        profile.organization_id === organizationId &&
        profile.is_active
      ) {
        byId.set(profile.id, profile);
      }
    }
  }

  return [...byId.values()].sort(compareProfilesForPlanning);
}
