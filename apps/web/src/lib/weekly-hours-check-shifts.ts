import { shiftWorkHoursFromRef } from "@/lib/shift-work-hours";
import type { ShiftTypeBreakInput } from "@schichtwerk/database";
import type { AreaShiftTemplateWithBreaks, ShiftConfirmationStatus } from "@schichtwerk/types";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import type { PlanningShift } from "@/lib/planning-shift-card";
import type { ShiftForWeeklyHoursConflict } from "@schichtwerk/database";
import type { ShiftAssignWeekShiftRef } from "@/lib/shift-weekly-hours-validation-client";
import { buildBreaksByTemplateIdFromAreaTemplates } from "@/lib/shift-work-hours";

export function weeklyHoursCheckShiftFromAreaCalendarCard(
  shift: AreaCalendarShiftCard,
  options?: {
    breaksByTemplateId?: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>;
    templates?: readonly AreaShiftTemplateWithBreaks[];
  }
): ShiftForWeeklyHoursConflict {
  return {
    id: shift.id,
    employeeId: shift.employeeId,
    shift_date: shift.shift_date,
    durationHours: shiftWorkHoursFromRef(
      {
        startTime: shift.startTime,
        endTime: shift.endTime,
        area_shift_template_id: shift.areaShiftTemplateId,
      },
      options
    ),
    confirmation_status: shift.confirmationStatus ?? null,
  };
}

export function weeklyHoursCheckShiftFromPlanningShift(
  shift: PlanningShift,
  options?: {
    breaksByTemplateId?: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>;
    templates?: readonly AreaShiftTemplateWithBreaks[];
  }
): ShiftForWeeklyHoursConflict {
  return {
    id: shift.id,
    employeeId: shift.employee_id,
    shift_date: shift.shift_date,
    durationHours: shiftWorkHoursFromRef(
      {
        startTime: shift.startTime,
        endTime: shift.endTime,
        area_shift_template_id: shift.area_shift_template_id,
      },
      options
    ),
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
    areaShiftTemplateId?: string | null;
  }[]
): ShiftAssignWeekShiftRef[] {
  return shifts.map((shift) => ({
    id: shift.id,
    employee_id: shift.employeeId,
    shift_date: shift.shift_date,
    startTime: shift.startTime,
    endTime: shift.endTime,
    area_shift_template_id: shift.areaShiftTemplateId ?? null,
  }));
}

export function shiftAssignWeekShiftsFromPlanningShifts(
  shifts: readonly {
    id: string;
    employee_id: string;
    shift_date: string;
    startTime: string;
    endTime: string;
    area_shift_template_id?: string | null;
  }[]
): ShiftAssignWeekShiftRef[] {
  return shifts.map((shift) => ({
    id: shift.id,
    employee_id: shift.employee_id,
    shift_date: shift.shift_date,
    startTime: shift.startTime,
    endTime: shift.endTime,
    area_shift_template_id: shift.area_shift_template_id ?? null,
  }));
}

export function weeklyHoursBreaksByTemplateIdFromTemplates(
  templates: readonly AreaShiftTemplateWithBreaks[]
): Map<string, ShiftTypeBreakInput[]> {
  return buildBreaksByTemplateIdFromAreaTemplates(templates);
}

/** Schichten einer Planungswoche — für Wochenstunden wie serverseitige Validierung. */
export function planningShiftsForCalendarWeek(
  shifts: readonly PlanningShift[],
  weekDates: readonly string[]
): PlanningShift[] {
  const weekDateSet = new Set(weekDates);
  return shifts.filter((shift) => weekDateSet.has(shift.shift_date));
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
