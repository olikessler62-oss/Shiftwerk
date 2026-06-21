import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import type { Profile, ShiftCardDisplayState, ShiftConfirmationStatus } from "@schichtwerk/types";

export type PlanningShift = {
  id: string;
  employee_id: string;
  shift_date: string;
  shiftName: string;
  color: string;
  startTime: string;
  endTime: string;
  location_area_id: string | null;
  area_shift_template_id: string | null;
  confirmationStatus?: ShiftConfirmationStatus;
  requestedAt?: string | null;
  confirmationStatusUpdatedAt?: string | null;
  displayState?: ShiftCardDisplayState;
  /** Tätigkeit in dieser Schicht (aus Personalbedarf-Zuordnung). */
  jobName?: string | null;
};

export function planningShiftToAreaCalendarCard(
  shift: PlanningShift,
  employee: Profile
): AreaCalendarShiftCard {
  return {
    id: shift.id,
    shift_date: shift.shift_date,
    locationAreaId: shift.location_area_id,
    areaShiftTemplateId: shift.area_shift_template_id,
    employeeId: shift.employee_id,
    shiftName: shift.shiftName,
    color: shift.color,
    startTime: shift.startTime,
    endTime: shift.endTime,
    employeeName: employee.full_name,
    employeeColor: employee.color ?? null,
    confirmationStatus: shift.confirmationStatus,
    requestedAt: shift.requestedAt,
    confirmationStatusUpdatedAt: shift.confirmationStatusUpdatedAt,
    displayState: shift.displayState,
  };
}

/** Inhaltbreite einer Planungs-Tagzelle (Spalte minus Zell-Padding). */
export function planningCollapsedCellWidthPx(
  columnWidthPx: number,
  cellPaddingPx: number
): number {
  return Math.max(columnWidthPx - cellPaddingPx * 2, 1);
}
