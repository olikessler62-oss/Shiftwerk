import type { Profile, ProfileHourlyRate } from "@schichtwerk/types";
import type { OverviewEmployeeJumpOption } from "@/lib/overview-employee-jump";
import { sortProfileHourlyRatesByValidFromDesc } from "@/lib/profile-hourly-rate-display";

export const OVERVIEW_COMPENSATION_PLACEHOLDER_ROW_PREFIX = "placeholder:";

export function overviewCompensationPlaceholderRowId(employeeId: string): string {
  return `${OVERVIEW_COMPENSATION_PLACEHOLDER_ROW_PREFIX}${employeeId}`;
}

export function isOverviewCompensationPlaceholderRow(
  row: Pick<OverviewCompensationDisplayRow, "id" | "isPlaceholder">
): boolean {
  return row.isPlaceholder;
}

export type OverviewCompensationDisplayRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeColor: string | null;
  showEmployeeName: boolean;
  rate: ProfileHourlyRate | null;
  isCurrentRate: boolean;
  isPlaceholder: boolean;
};

function compareEmployeeIds(
  profileById: Map<string, Profile>,
  a: string,
  b: string
): number {
  const nameA = profileById.get(a)?.full_name ?? "";
  const nameB = profileById.get(b)?.full_name ?? "";
  const byName = nameA.localeCompare(nameB, "de");
  if (byName !== 0) return byName;
  return a.localeCompare(b);
}

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

  const employeeIds = [
    ...new Set([...input.profiles.map((profile) => profile.id), ...grouped.keys()]),
  ].sort((a, b) => compareEmployeeIds(profileById, a, b));

  const rows: OverviewCompensationDisplayRow[] = [];
  for (const employeeId of employeeIds) {
    const profile = profileById.get(employeeId);
    const employeeRates = sortProfileHourlyRatesByValidFromDesc(
      grouped.get(employeeId) ?? []
    );

    if (employeeRates.length === 0) {
      if (!profile) continue;
      rows.push({
        id: overviewCompensationPlaceholderRowId(employeeId),
        employeeId,
        employeeName: profile.full_name,
        employeeColor: profile.color ?? null,
        showEmployeeName: true,
        rate: null,
        isCurrentRate: false,
        isPlaceholder: true,
      });
      continue;
    }

    employeeRates.forEach((rate, index) => {
      rows.push({
        id: rate.id,
        employeeId,
        employeeName: profile?.full_name ?? "—",
        employeeColor: profile?.color ?? null,
        showEmployeeName: index === 0,
        rate,
        isCurrentRate: index === 0,
        isPlaceholder: false,
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
