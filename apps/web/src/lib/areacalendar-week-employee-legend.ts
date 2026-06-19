import {
  absenceRequestToRange,
  isDateWithinAbsenceRange,
} from "@schichtwerk/database";
import type { AbsenceRequest } from "@schichtwerk/types";
import { shiftHoursFromWindow } from "@/lib/planning-utils";
import {
  SHIFT_CARD_SHADOW_BLEED_PX,
  SHIFT_CARD_TWO_LINE_HEIGHT_PX,
} from "@/lib/shift-card-row-layout";

/** Breite der Mitarbeiterliste links neben dem Bereich-Kalender (75 % von 208px / früher w-52). */
export const AREA_CALENDAR_EMPLOYEE_LIST_WIDTH_PX = 156;
/** Zusätzlicher Abstand nach unten — nur Mitarbeiterliste, Kalender unverändert. */
export const AREA_CALENDAR_EMPLOYEE_LIST_TOP_OFFSET_PX = 50;
/** Schichtkarten-Höhe in der Mitarbeiterliste (+50 % gegenüber Kalender-Schichtkarte). */
export const AREA_CALENDAR_EMPLOYEE_LEGEND_CARD_HEIGHT_PX = Math.round(
  SHIFT_CARD_TWO_LINE_HEIGHT_PX * 1.5
);
export const AREA_CALENDAR_EMPLOYEE_LEGEND_CARD_LIST_ITEM_HEIGHT_PX =
  AREA_CALENDAR_EMPLOYEE_LEGEND_CARD_HEIGHT_PX + SHIFT_CARD_SHADOW_BLEED_PX;
/** Kalender-Schichtkarte: 11px / 10px — Liste jeweils +2px. */
export const AREA_CALENDAR_EMPLOYEE_LEGEND_PRIMARY_FONT_PX = 13;
export const AREA_CALENDAR_EMPLOYEE_LEGEND_SECONDARY_FONT_PX = 12;
/** Feste Zeilenhöhe in der Bereich-Kalender-Mitarbeiterliste. */
export const DASHBOARD_SIDEBAR_EMPLOYEE_ROW_HEIGHT_PX = 44;
export const DASHBOARD_SIDEBAR_EMPLOYEE_MAX_VISIBLE = 10;
/** @deprecated Frühere Sidebar-Höhenbegrenzung; Kalenderpanel nutzt volle Spaltenhöhe. */
export const DASHBOARD_SIDEBAR_EMPLOYEE_LIST_MAX_HEIGHT_PX =
  DASHBOARD_SIDEBAR_EMPLOYEE_ROW_HEIGHT_PX *
  DASHBOARD_SIDEBAR_EMPLOYEE_MAX_VISIBLE;

export type AreaCalendarWeekLegendEmployee = {
  id: string;
  full_name: string;
  color: string | null;
  weekly_hours: number | null;
};

type AreaCalendarShiftRef = {
  employeeId: string;
  employeeName: string;
  employeeColor: string | null;
  shift_date: string;
  startTime: string;
  endTime: string;
};

export function isAreaCalendarEmployeeAbsentOnDate(
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

export function areaCalendarEmployeeWeekHours(
  employeeId: string,
  shifts: readonly AreaCalendarShiftRef[],
  absences: readonly AbsenceRequest[] = []
): number {
  let total = 0;
  for (const shift of shifts) {
    if (shift.employeeId !== employeeId) continue;
    if (
      isAreaCalendarEmployeeAbsentOnDate(employeeId, shift.shift_date, absences)
    ) {
      continue;
    }
    total += shiftHoursFromWindow(shift.startTime, shift.endTime);
  }
  return Math.round(total * 10) / 10;
}

/** Mitarbeiter mit mindestens einer Schicht in der Kalenderwoche. */
export function collectWeekLegendEmployeesFromAreaCalendarShifts(
  shifts: readonly AreaCalendarShiftRef[],
  profiles: readonly ProfileRef[],
  _absences: readonly AbsenceRequest[] = []
): AreaCalendarWeekLegendEmployee[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const byId = new Map<string, AreaCalendarWeekLegendEmployee>();

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
