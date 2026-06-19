import type { AbsenceRequest, AbsenceType, Profile, RequestStatus } from "@schichtwerk/types";

const OVERVIEW_ABSENCE_STATUSES: RequestStatus[] = ["approved", "pending"];

export type OverviewAbsenceDisplayRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeColor: string | null;
  showEmployeeName: boolean;
  type: AbsenceType;
  status: RequestStatus;
  startDate: string;
  endDate: string | null;
  isOpenEnded: boolean;
};

export function absenceExtendsOnOrAfterDate(
  absence: Pick<AbsenceRequest, "end_date" | "is_open_ended" | "start_date">,
  dateISO: string
): boolean {
  if (absence.is_open_ended && !absence.end_date) return true;
  if (!absence.end_date) return absence.start_date >= dateISO;
  return absence.end_date >= dateISO;
}

export function filterOverviewAbsences(
  absences: readonly AbsenceRequest[],
  todayISO: string
): AbsenceRequest[] {
  return absences.filter(
    (absence) =>
      OVERVIEW_ABSENCE_STATUSES.includes(absence.status) &&
      absenceExtendsOnOrAfterDate(absence, todayISO)
  );
}

export function buildOverviewAbsenceDisplayRows(input: {
  absences: readonly AbsenceRequest[];
  profiles: readonly Profile[];
  todayISO: string;
}): OverviewAbsenceDisplayRow[] {
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const filtered = filterOverviewAbsences(input.absences, input.todayISO);

  const grouped = new Map<string, AbsenceRequest[]>();
  for (const absence of filtered) {
    const list = grouped.get(absence.employee_id) ?? [];
    list.push(absence);
    grouped.set(absence.employee_id, list);
  }

  const employeeIds = [...grouped.keys()].sort((a, b) => {
    const nameA = profileById.get(a)?.full_name ?? "";
    const nameB = profileById.get(b)?.full_name ?? "";
    const byName = nameA.localeCompare(nameB, "de");
    if (byName !== 0) return byName;
    return a.localeCompare(b);
  });

  const rows: OverviewAbsenceDisplayRow[] = [];
  for (const employeeId of employeeIds) {
    const profile = profileById.get(employeeId);
    const employeeAbsences = [...(grouped.get(employeeId) ?? [])].sort((a, b) => {
      const byStart = a.start_date.localeCompare(b.start_date);
      if (byStart !== 0) return byStart;
      return a.id.localeCompare(b.id);
    });

    employeeAbsences.forEach((absence, index) => {
      rows.push({
        id: absence.id,
        employeeId,
        employeeName: profile?.full_name ?? "—",
        employeeColor: profile?.color ?? null,
        showEmployeeName: index === 0,
        type: absence.type,
        status: absence.status,
        startDate: absence.start_date,
        endDate: absence.end_date,
        isOpenEnded: absence.is_open_ended,
      });
    });
  }

  return rows;
}

export function countOverviewAbsenceEmployees(
  rows: readonly OverviewAbsenceDisplayRow[]
): number {
  return new Set(rows.map((row) => row.employeeId)).size;
}

export type OverviewAbsenceEmployeeJumpOption =
  import("@/lib/overview-employee-jump").OverviewEmployeeJumpOption;

export function buildOverviewAbsenceEmployeeJumpOptions(
  profiles: readonly Pick<Profile, "id" | "full_name" | "color">[],
  rows: readonly OverviewAbsenceDisplayRow[]
): OverviewAbsenceEmployeeJumpOption[] {
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

export function firstOverviewAbsenceRowIdForEmployee(
  rows: readonly OverviewAbsenceDisplayRow[],
  employeeId: string
): string | null {
  return rows.find((row) => row.employeeId === employeeId)?.id ?? null;
}
