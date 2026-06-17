import {
  absenceRequestToRange,
  isDateWithinAbsenceRange,
} from "@schichtwerk/database";
import type { AbsenceRequest } from "@schichtwerk/types";
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
  shift_date: string;
  startTime: string;
  endTime: string;
};

export function isDashboardEmployeeAbsentOnDate(
  employeeId: string,
  dateISO: string,
  absences: readonly AbsenceRequest[]
): boolean {
  for (const absence of absences) {
    if (absence.status !== "approved") continue;
    if (absence.employee_id !== employeeId) continue;
    const range = absenceRequestToRange(absence);
    if (isDateWithinAbsenceRange(range, dateISO)) return true;
  }
  return false;
}

type ProfileRef = {
  id: string;
  full_name: string;
  color: string | null;
  weekly_hours: number | null;
};

export function dashboardEmployeeWeekHours(
  employeeId: string,
  shifts: readonly DashboardShiftRef[],
  absences: readonly AbsenceRequest[] = []
): number {
  let total = 0;
  for (const shift of shifts) {
    if (shift.employeeId !== employeeId) continue;
    if (
      isDashboardEmployeeAbsentOnDate(employeeId, shift.shift_date, absences)
    ) {
      continue;
    }
    total += shiftHoursFromWindow(shift.startTime, shift.endTime);
  }
  return Math.round(total * 10) / 10;
}

/** Mitarbeiter mit mindestens einer Schicht in der Kalenderwoche (ohne Abwesenheitstag). */
export function collectWeekLegendEmployeesFromDashboardShifts(
  shifts: readonly DashboardShiftRef[],
  profiles: readonly ProfileRef[],
  absences: readonly AbsenceRequest[] = []
): DashboardWeekLegendEmployee[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const byId = new Map<string, DashboardWeekLegendEmployee>();

  for (const shift of shifts) {
    if (
      isDashboardEmployeeAbsentOnDate(
        shift.employeeId,
        shift.shift_date,
        absences
      )
    ) {
      continue;
    }
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
