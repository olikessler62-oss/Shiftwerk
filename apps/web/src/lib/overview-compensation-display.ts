import type { Profile, ProfileHourlyRate } from "@schichtwerk/types";
import type { OverviewEmployeeJumpOption } from "@/lib/overview-employee-jump";
import { sortProfileHourlyRatesByValidFromDesc } from "@/lib/profile-hourly-rate-display";

export type OverviewCompensationDisplayRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeColor: string | null;
  showEmployeeName: boolean;
  rate: ProfileHourlyRate;
  isCurrentRate: boolean;
};

export function buildOverviewCompensationDisplayRows(input: {
  rates: readonly ProfileHourlyRate[];
  profiles: readonly Profile[];
}): OverviewCompensationDisplayRow[] {
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const grouped = new Map<string, ProfileHourlyRate[]>();

  for (const rate of input.rates) {
    const list = grouped.get(rate.profile_id) ?? [];
    list.push(rate);
    grouped.set(rate.profile_id, list);
  }

  const employeeIds = [...grouped.keys()].sort((a, b) => {
    const nameA = profileById.get(a)?.full_name ?? "";
    const nameB = profileById.get(b)?.full_name ?? "";
    const byName = nameA.localeCompare(nameB, "de");
    if (byName !== 0) return byName;
    return a.localeCompare(b);
  });

  const rows: OverviewCompensationDisplayRow[] = [];
  for (const employeeId of employeeIds) {
    const profile = profileById.get(employeeId);
    const employeeRates = sortProfileHourlyRatesByValidFromDesc(
      grouped.get(employeeId) ?? []
    );

    employeeRates.forEach((rate, index) => {
      rows.push({
        id: rate.id,
        employeeId,
        employeeName: profile?.full_name ?? "—",
        employeeColor: profile?.color ?? null,
        showEmployeeName: index === 0,
        rate,
        isCurrentRate: index === 0,
      });
    });
  }

  return rows;
}

export function countOverviewCompensationEmployees(
  rows: readonly OverviewCompensationDisplayRow[]
): number {
  return new Set(rows.map((row) => row.employeeId)).size;
}

export function buildOverviewCompensationEmployeeJumpOptions(
  profiles: readonly Pick<Profile, "id" | "full_name" | "color">[],
  rows: readonly OverviewCompensationDisplayRow[]
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

export function firstOverviewCompensationRowIdForEmployee(
  rows: readonly OverviewCompensationDisplayRow[],
  employeeId: string
): string | null {
  return rows.find((row) => row.employeeId === employeeId)?.id ?? null;
}
