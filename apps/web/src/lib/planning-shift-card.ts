import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import type { Profile } from "@schichtwerk/types";

export type PlanningShift = {
  id: string;
  employee_id: string;
  shift_date: string;
  shiftName: string;
  color: string;
  startTime: string;
  endTime: string;
};

export function planningShiftToDashboardCard(
  shift: PlanningShift,
  employee: Profile
): DashboardShiftCard {
  return {
    id: shift.id,
    shift_date: shift.shift_date,
    locationAreaId: null,
    areaShiftTemplateId: null,
    employeeId: shift.employee_id,
    shiftName: shift.shiftName,
    color: shift.color,
    startTime: shift.startTime,
    endTime: shift.endTime,
    employeeName: employee.full_name,
    employeeColor: employee.color ?? null,
  };
}

/** Inhaltbreite einer Planungs-Tagzelle (Spalte minus Zell-Padding). */
export function planningCollapsedCellWidthPx(
  columnWidthPx: number,
  cellPaddingPx: number
): number {
  return Math.max(columnWidthPx - cellPaddingPx * 2, 1);
}
