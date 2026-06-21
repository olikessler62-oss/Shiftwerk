import { shiftDurationHours } from "@schichtwerk/database";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import type { PlanningShift } from "@/lib/planning-shift-card";
import type { ShiftForWeeklyHoursConflict } from "@schichtwerk/database";
import type { ShiftAssignWeekShiftRef } from "@/lib/shift-weekly-hours-validation-client";

export function weeklyHoursCheckShiftFromAreaCalendarCard(
  shift: AreaCalendarShiftCard
): ShiftForWeeklyHoursConflict {
  return {
    id: shift.id,
    employeeId: shift.employeeId,
    shift_date: shift.shift_date,
    durationHours: shiftDurationHours(shift.startTime, shift.endTime),
    confirmation_status: shift.confirmationStatus ?? null,
  };
}

export function weeklyHoursCheckShiftFromPlanningShift(
  shift: PlanningShift
): ShiftForWeeklyHoursConflict {
  return {
    id: shift.id,
    employeeId: shift.employee_id,
    shift_date: shift.shift_date,
    durationHours: shiftDurationHours(shift.startTime, shift.endTime),
    confirmation_status: shift.confirmationStatus ?? null,
  };
}

export function weeklyHoursByEmployeeIdFromProfiles(
  profiles: readonly { id: string; weekly_hours: number | null }[]
): Map<string, number | null> {
  return new Map(profiles.map((profile) => [profile.id, profile.weekly_hours]));
}

export function weeklyHoursByEmployeeIdFromEmployees(
  employees: readonly { id: string; weekly_hours: number | null }[]
): Map<string, number | null> {
  return new Map(employees.map((employee) => [employee.id, employee.weekly_hours]));
}

export function shiftAssignWeekShiftsFromAreaCalendarCards(
  shifts: readonly {
    id: string;
    employeeId: string;
    shift_date: string;
    startTime: string;
    endTime: string;
  }[]
): ShiftAssignWeekShiftRef[] {
  return shifts.map((shift) => ({
    id: shift.id,
    employee_id: shift.employeeId,
    shift_date: shift.shift_date,
    startTime: shift.startTime,
    endTime: shift.endTime,
  }));
}

export function shiftAssignWeekShiftsFromPlanningShifts(
  shifts: readonly {
    id: string;
    employee_id: string;
    shift_date: string;
    startTime: string;
    endTime: string;
  }[]
): ShiftAssignWeekShiftRef[] {
  return shifts.map((shift) => ({
    id: shift.id,
    employee_id: shift.employee_id,
    shift_date: shift.shift_date,
    startTime: shift.startTime,
    endTime: shift.endTime,
  }));
}

export type WeeklyHoursConflictWarningShift = {
  id: string;
  shift_date: string;
  startTime: string;
  endTime: string;
  confirmationStatus: ShiftConfirmationStatus | null;
  weekTotalHours: number;
  targetHours: number;
};

export function formatWeeklyHoursConflictWarningShift(
  shift: ShiftForWeeklyHoursConflict & {
    weekTotalHours: number;
    targetHours: number;
    startTime: string;
    endTime: string;
  },
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  return t("profiles.weeklyHoursChangeConflictLine", {
    date: shift.shift_date,
    time: `${shift.startTime}–${shift.endTime}`,
    status: shift.confirmation_status ?? "proposed",
    weekTotal: shift.weekTotalHours,
    target: shift.targetHours,
  });
}
