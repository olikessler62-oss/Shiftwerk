import { sortProfileShiftPreferencesBySchedule } from "@schichtwerk/database";
import type { Profile, ProfileShiftPreference } from "@schichtwerk/types";
import type { OverviewEmployeeJumpOption } from "@/lib/overview-employee-jump";

export type OverviewShiftPreferenceDisplayRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeColor: string | null;
  showEmployeeName: boolean;
  preference: ProfileShiftPreference;
};

export function buildOverviewShiftPreferenceDisplayRows(input: {
  preferences: readonly ProfileShiftPreference[];
  profiles: readonly Profile[];
}): OverviewShiftPreferenceDisplayRow[] {
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const grouped = new Map<string, ProfileShiftPreference[]>();

  for (const preference of input.preferences) {
    const list = grouped.get(preference.profile_id) ?? [];
    list.push(preference);
    grouped.set(preference.profile_id, list);
  }

  const employeeIds = [...grouped.keys()].sort((a, b) => {
    const nameA = profileById.get(a)?.full_name ?? "";
    const nameB = profileById.get(b)?.full_name ?? "";
    const byName = nameA.localeCompare(nameB, "de");
    if (byName !== 0) return byName;
    return a.localeCompare(b);
  });

  const rows: OverviewShiftPreferenceDisplayRow[] = [];
  for (const employeeId of employeeIds) {
    const profile = profileById.get(employeeId);
    const employeePreferences = sortProfileShiftPreferencesBySchedule(
      grouped.get(employeeId) ?? []
    );

    employeePreferences.forEach((preference, index) => {
      rows.push({
        id: preference.id,
        employeeId,
        employeeName: profile?.full_name ?? "—",
        employeeColor: profile?.color ?? null,
        showEmployeeName: index === 0,
        preference,
      });
    });
  }

  return rows;
}

export function countOverviewShiftPreferenceEmployees(
  rows: readonly OverviewShiftPreferenceDisplayRow[]
): number {
  return new Set(rows.map((row) => row.employeeId)).size;
}

export function buildOverviewShiftPreferenceEmployeeJumpOptions(
  profiles: readonly Pick<Profile, "id" | "full_name" | "color">[],
  rows: readonly OverviewShiftPreferenceDisplayRow[]
): OverviewEmployeeJumpOption[] {
  const firstRowIdByEmployeeId = new Map<string, string>();
  for (const row of rows) {
    if (!firstRowIdByEmployeeId.has(row.employeeId)) {
      firstRowIdByEmployeeId.set(row.employeeId, row.id);
    }
  }

  return profiles.map((profile) => ({
    employeeId: profile.id,
    employeeName: profile.full_name,
    employeeColor: profile.color ?? null,
    firstRowId: firstRowIdByEmployeeId.get(profile.id) ?? null,
  }));
}

export function firstOverviewShiftPreferenceRowIdForEmployee(
  rows: readonly OverviewShiftPreferenceDisplayRow[],
  employeeId: string
): string | null {
  return rows.find((row) => row.employeeId === employeeId)?.id ?? null;
}
