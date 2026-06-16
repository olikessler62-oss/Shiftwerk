import { shiftHoursFromWindow } from "@/lib/planning-utils";

/** Feste Zeilenhöhe in der Dashboard-Sidebar — Basis für max. 10 sichtbare Einträge. */
export const DASHBOARD_SIDEBAR_EMPLOYEE_ROW_HEIGHT_PX = 44;
export const DASHBOARD_SIDEBAR_EMPLOYEE_MAX_VISIBLE = 10;
export const DASHBOARD_SIDEBAR_EMPLOYEE_LIST_MAX_HEIGHT_PX =
  DASHBOARD_SIDEBAR_EMPLOYEE_ROW_HEIGHT_PX *
  DASHBOARD_SIDEBAR_EMPLOYEE_MAX_VISIBLE;

export type DashboardWeekLegendEmployee = {
  id: string;
  full_name: string;
  color: string | null;
  weekly_hours: number | null;
};

type DashboardShiftRef = {
  employeeId: string;
  employeeName: string;
  employeeColor: string | null;
  startTime: string;
  endTime: string;
};

type ProfileRef = {
  id: string;
  full_name: string;
  color: string | null;
  weekly_hours: number | null;
};

export function dashboardEmployeeWeekHours(
  employeeId: string,
  shifts: readonly DashboardShiftRef[]
): number {
  let total = 0;
  for (const shift of shifts) {
    if (shift.employeeId !== employeeId) continue;
    total += shiftHoursFromWindow(shift.startTime, shift.endTime);
  }
  return Math.round(total * 10) / 10;
}

/** Mitarbeiter mit mindestens einer Schicht in der Kalenderwoche. */
export function collectWeekLegendEmployeesFromDashboardShifts(
  shifts: readonly DashboardShiftRef[],
  profiles: readonly ProfileRef[]
): DashboardWeekLegendEmployee[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const byId = new Map<string, DashboardWeekLegendEmployee>();

  for (const shift of shifts) {
    if (byId.has(shift.employeeId)) continue;
    const profile = profileById.get(shift.employeeId);
    byId.set(shift.employeeId, {
      id: shift.employeeId,
      full_name: profile?.full_name ?? shift.employeeName,
      color: profile?.color ?? shift.employeeColor,
      weekly_hours: profile?.weekly_hours ?? null,
    });
  }

  return [...byId.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "de")
  );
}
