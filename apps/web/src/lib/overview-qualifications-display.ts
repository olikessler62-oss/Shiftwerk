import type { Profile, Qualification } from "@schichtwerk/types";
import type { OverviewEmployeeJumpOption } from "@/lib/overview-employee-jump";

export type OverviewProfileQualificationAssignment = {
  profile_id: string;
  qualification: Qualification;
};

export type OverviewQualificationDisplayRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeColor: string | null;
  showEmployeeName: boolean;
  qualification: Qualification;
};

export function overviewQualificationRowId(
  profileId: string,
  qualificationId: string
): string {
  return `${profileId}:${qualificationId}`;
}

export function parseOverviewQualificationRowId(
  rowId: string
): { profileId: string; qualificationId: string } | null {
  const separatorIndex = rowId.indexOf(":");
  if (separatorIndex <= 0) return null;
  return {
    profileId: rowId.slice(0, separatorIndex),
    qualificationId: rowId.slice(separatorIndex + 1),
  };
}

export function buildOverviewQualificationDisplayRows(input: {
  assignments: readonly OverviewProfileQualificationAssignment[];
  profiles: readonly Profile[];
}): OverviewQualificationDisplayRow[] {
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const grouped = new Map<string, Qualification[]>();

  for (const assignment of input.assignments) {
    const list = grouped.get(assignment.profile_id) ?? [];
    list.push(assignment.qualification);
    grouped.set(assignment.profile_id, list);
  }

  const employeeIds = [...grouped.keys()].sort((a, b) => {
    const nameA = profileById.get(a)?.full_name ?? "";
    const nameB = profileById.get(b)?.full_name ?? "";
    const byName = nameA.localeCompare(nameB, "de");
    if (byName !== 0) return byName;
    return a.localeCompare(b);
  });

  const rows: OverviewQualificationDisplayRow[] = [];
  for (const employeeId of employeeIds) {
    const profile = profileById.get(employeeId);
    const qualifications = [...(grouped.get(employeeId) ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "de")
    );

    qualifications.forEach((qualification, index) => {
      rows.push({
        id: overviewQualificationRowId(employeeId, qualification.id),
        employeeId,
        employeeName: profile?.full_name ?? "—",
        employeeColor: profile?.color ?? null,
        showEmployeeName: index === 0,
        qualification,
      });
    });
  }

  return rows;
}

export function countOverviewQualificationEmployees(
  rows: readonly OverviewQualificationDisplayRow[]
): number {
  return new Set(rows.map((row) => row.employeeId)).size;
}

export function buildOverviewQualificationEmployeeJumpOptions(
  profiles: readonly Pick<Profile, "id" | "full_name" | "color">[],
  rows: readonly OverviewQualificationDisplayRow[]
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

export function firstOverviewQualificationRowIdForEmployee(
  rows: readonly OverviewQualificationDisplayRow[],
  employeeId: string
): string | null {
  return rows.find((row) => row.employeeId === employeeId)?.id ?? null;
}
