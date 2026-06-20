import type { AreaCalendarShiftAssignEmployee } from "@/app/actions/areacalendar-shift-assign";
import {
  areAreaCalendarShiftTimesComplete,
  employeeMatchesAreaCalendarShiftAssignWindow,
} from "@/lib/available-employees-for-shift";
import { resolvePresetIdFromTimes } from "@/lib/areacalendar-assignment-presets";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import { useCallback, useEffect, useRef, useState } from "react";

export function isEmployeeShiftOutsideAvailability(
  employee: Pick<AreaCalendarShiftAssignEmployee, "availabilities"> | null | undefined,
  weekday: number,
  startTime: string,
  endTime: string
): boolean {
  if (!employee || !areAreaCalendarShiftTimesComplete(startTime, endTime)) {
    return false;
  }
  return !employeeMatchesAreaCalendarShiftAssignWindow(
    employee.availabilities,
    weekday,
    startTime,
    endTime
  );
}

export function evaluateShiftAssignAvailabilityConflict(input: {
  employeeId: string;
  emptyEmployeeId?: string;
  employees: readonly AreaCalendarShiftAssignEmployee[];
  weekday: number;
  startTime: string;
  endTime: string;
}): boolean {
  const emptyEmployeeId = input.emptyEmployeeId ?? "";
  if (!input.employeeId || input.employeeId === emptyEmployeeId) {
    return false;
  }
  const employee = input.employees.find((entry) => entry.id === input.employeeId);
  return isEmployeeShiftOutsideAvailability(
    employee,
    input.weekday,
    input.startTime,
    input.endTime
  );
}

export const SHIFT_ASSIGN_AVAILABILITY_CONFLICT_ERRORS = [
  "Schichtzeit liegt außerhalb der Verfügbarkeit des Personals.",
  "Personal hat an diesem Wochentag keine Verfügbarkeit.",
] as const;

export function isShiftAssignAvailabilityConflictError(error: string): boolean {
  return (SHIFT_ASSIGN_AVAILABILITY_CONFLICT_ERRORS as readonly string[]).includes(
    error
  );
}

type UseShiftAssignAvailabilityNoticeParams = {
  weekday: number;
  startTime: string;
  endTime: string;
  employeeId: string;
  emptyEmployeeId?: string;
  employees: readonly AreaCalendarShiftAssignEmployee[];
  loadingEmployees: boolean;
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  shiftTypeId: string;
  timesComplete: boolean;
};

export function useShiftAssignAvailabilityNotice({
  weekday,
  startTime,
  endTime,
  employeeId,
  emptyEmployeeId = "",
  employees,
  loadingEmployees,
  assignmentPresets,
  shiftTypeId,
  timesComplete,
}: UseShiftAssignAvailabilityNoticeParams) {
  const [visible, setVisible] = useState(false);
  const initialCheckDoneRef = useRef(false);
  const pendingTimeEditRef = useRef(false);
  const shiftTypeIdBeforeTimeEditRef = useRef("");

  const evaluateConflict = useCallback(
    (overrides?: {
      employeeId?: string;
      startTime?: string;
      endTime?: string;
    }) =>
      evaluateShiftAssignAvailabilityConflict({
        employeeId: overrides?.employeeId ?? employeeId,
        emptyEmployeeId,
        employees,
        weekday,
        startTime: overrides?.startTime ?? startTime,
        endTime: overrides?.endTime ?? endTime,
      }),
    [employeeId, emptyEmployeeId, employees, weekday, startTime, endTime]
  );

  const runCheck = useCallback(
    (overrides?: {
      employeeId?: string;
      startTime?: string;
      endTime?: string;
    }) => {
      setVisible(evaluateConflict(overrides));
    },
    [evaluateConflict]
  );

  useEffect(() => {
    if (initialCheckDoneRef.current) return;
    if (loadingEmployees || !timesComplete) return;
    if (!employeeId || employeeId === emptyEmployeeId) return;
    if (!employees.some((entry) => entry.id === employeeId)) return;

    initialCheckDoneRef.current = true;
    runCheck();
  }, [
    loadingEmployees,
    timesComplete,
    employeeId,
    emptyEmployeeId,
    employees,
    runCheck,
  ]);

  useEffect(() => {
    if (!pendingTimeEditRef.current || !timesComplete) return;
    pendingTimeEditRef.current = false;
    const matchedPresetId =
      resolvePresetIdFromTimes(startTime, endTime, assignmentPresets) ?? "";
    if (matchedPresetId && matchedPresetId !== shiftTypeIdBeforeTimeEditRef.current) {
      runCheck();
    }
  }, [
    startTime,
    endTime,
    timesComplete,
    assignmentPresets,
    runCheck,
  ]);

  const beforeTimeInputChange = useCallback(() => {
    pendingTimeEditRef.current = true;
    shiftTypeIdBeforeTimeEditRef.current = shiftTypeId;
    setVisible(false);
  }, [shiftTypeId]);

  const notifyEmployeeChange = useCallback(
    (nextEmployeeId: string) => {
      runCheck({ employeeId: nextEmployeeId });
    },
    [runCheck]
  );

  const notifyShiftTemplateChange = useCallback(
    (nextStartTime: string, nextEndTime: string) => {
      runCheck({ startTime: nextStartTime, endTime: nextEndTime });
    },
    [runCheck]
  );

  return {
    visible,
    runAvailabilityCheck: runCheck,
    beforeTimeInputChange,
    notifyEmployeeChange,
    notifyShiftTemplateChange,
  };
}
