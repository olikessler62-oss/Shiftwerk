import type { Profile, ProfileCompensationSurcharge } from "@schichtwerk/types";
import type { OverviewEmployeeJumpOption } from "@/lib/overview-employee-jump";
import { sortProfileCompensationSurchargesByValidFromDesc } from "@/lib/profile-surcharge-display";

export type OverviewSurchargeDisplayRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeColor: string | null;
  showEmployeeName: boolean;
  entry: ProfileCompensationSurcharge;
};

export function buildOverviewSurchargeDisplayRows(input: {
  surcharges: readonly ProfileCompensationSurcharge[];
  profiles: readonly Profile[];
}): OverviewSurchargeDisplayRow[] {
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const grouped = new Map<string, ProfileCompensationSurcharge[]>();

  for (const entry of input.surcharges) {
    const list = grouped.get(entry.profile_id) ?? [];
    list.push(entry);
    grouped.set(entry.profile_id, list);
  }

  const employeeIds = [...grouped.keys()].sort((a, b) => {
    const nameA = profileById.get(a)?.full_name ?? "";
    const nameB = profileById.get(b)?.full_name ?? "";
    const byName = nameA.localeCompare(nameB, "de");
    if (byName !== 0) return byName;
    return a.localeCompare(b);
  });

  const rows: OverviewSurchargeDisplayRow[] = [];
  for (const employeeId of employeeIds) {
    const profile = profileById.get(employeeId);
    const employeeEntries = sortProfileCompensationSurchargesByValidFromDesc(
      grouped.get(employeeId) ?? []
    );

    employeeEntries.forEach((entry, index) => {
      rows.push({
        id: entry.id,
        employeeId,
        employeeName: profile?.full_name ?? "—",
        employeeColor: profile?.color ?? null,
        showEmployeeName: index === 0,
        entry,
      });
    });
  }

  return rows;
}

export function countOverviewSurchargeEmployees(
  rows: readonly OverviewSurchargeDisplayRow[]
): number {
  return new Set(rows.map((row) => row.employeeId)).size;
}

export function buildOverviewSurchargeEmployeeJumpOptions(
  profiles: readonly Pick<Profile, "id" | "full_name" | "color">[],
  rows: readonly OverviewSurchargeDisplayRow[]
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

export function firstOverviewSurchargeRowIdForEmployee(
  rows: readonly OverviewSurchargeDisplayRow[],
  employeeId: string
): string | null {
  return rows.find((row) => row.employeeId === employeeId)?.id ?? null;
}
