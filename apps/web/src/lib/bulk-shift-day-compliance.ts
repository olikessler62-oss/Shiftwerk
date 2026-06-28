import { areAreaCalendarShiftTimesComplete } from "@/lib/available-employees-for-shift";

const EMPTY_EMPLOYEE_ID = "";
import {
  validateEmployeeDayShiftAssignments,
  weekdayIndexFromDate,
  type DayShiftTimeWindow,
  type EmployeeDayShiftComplianceViolation,
} from "@schichtwerk/database";

export type LocationDayAssignment = {
  employeeId: string;
  startTime: string;
  endTime: string;
  locationAreaId: string | null;
};

type BulkShiftRowLike = {
  employeeId: string;
  startTime: string;
  endTime: string;
};

export function organizationDayShiftWindowsForEmployee(
  employeeId: string,
  organizationDayAssignments: readonly LocationDayAssignment[]
): DayShiftTimeWindow[] {
  return organizationDayAssignments
    .filter(
      (assignment) =>
        assignment.employeeId === employeeId &&
        areAreaCalendarShiftTimesComplete(assignment.startTime, assignment.endTime)
    )
    .map((assignment) => ({
      startTime: assignment.startTime,
      endTime: assignment.endTime,
    }));
}

export function employeeMeetsOrganizationDayShiftCompliance(input: {
  countryCode: string;
  shiftDate: string;
  employeeId: string;
  windowStart: string;
  windowEnd: string;
  organizationDayAssignments: readonly LocationDayAssignment[];
}): boolean {
  if (
    !areAreaCalendarShiftTimesComplete(input.windowStart, input.windowEnd)
  ) {
    return false;
  }

  const otherWindows = organizationDayShiftWindowsForEmployee(
    input.employeeId,
    input.organizationDayAssignments
  );
  const proposed = {
    startTime: input.windowStart,
    endTime: input.windowEnd,
  };
  const windows =
    otherWindows.length > 0 ? [...otherWindows, proposed] : [proposed];

  const result = validateEmployeeDayShiftAssignments({
    countryCode: input.countryCode,
    shiftDate: input.shiftDate,
    weekday: weekdayIndexFromDate(input.shiftDate),
    windows,
  });

  return result.ok;
}

export function filterEmployeesByOrganizationDayShiftCompliance<
  T extends { id: string },
>(
  employees: readonly T[],
  context: {
    countryCode: string;
    shiftDate: string;
    windowStart: string;
    windowEnd: string;
    organizationDayAssignments: readonly LocationDayAssignment[];
  }
): T[] {
  return employees.filter((employee) =>
    employeeMeetsOrganizationDayShiftCompliance({
      ...context,
      employeeId: employee.id,
    })
  );
}

function externalDayAssignmentsForBulkCompliance(
  organizationDayAssignments: readonly LocationDayAssignment[],
  currentAreaId: string
): LocationDayAssignment[] {
  return organizationDayAssignments.filter(
    (assignment) =>
      assignment.locationAreaId !== currentAreaId &&
      areAreaCalendarShiftTimesComplete(assignment.startTime, assignment.endTime)
  );
}

function formatHours(hours: number): string {
  return hours.toFixed(1).replace(".0", "");
}

function formatTimeSpan(window: DayShiftTimeWindow): string {
  return `${window.startTime}–${window.endTime}`;
}

function formatTimeSpans(windows: readonly DayShiftTimeWindow[]): string {
  return windows.map(formatTimeSpan).join(", ");
}

export function formatBulkShiftComplianceViolationMessage(
  violation: EmployeeDayShiftComplianceViolation,
  employeeName: string,
  windows: readonly DayShiftTimeWindow[],
  translate: (
    key: string,
    params?: Record<string, string | number>
  ) => string
): string {
  if (violation.kind === "shift_duration") {
    return translate("areaCalendar.bulkShiftValidationShiftDuration", {
      name: employeeName,
      start: violation.shiftStartTime ?? "",
      end: violation.shiftEndTime ?? "",
      hours: formatHours(violation.shiftDurationHours ?? 0),
      limit: violation.limitHours ?? 10,
    });
  }

  if (violation.kind === "daily_hours") {
    return translate("areaCalendar.bulkShiftValidationDailyHours", {
      name: employeeName,
      total: formatHours(violation.totalHours ?? 0),
      limit: violation.limitHours ?? 8,
      spans: formatTimeSpans(windows),
    });
  }

  return translate("areaCalendar.bulkShiftValidationRestPeriod", {
    name: employeeName,
    minRest: violation.minRestHours ?? 11,
    actualRest: formatHours(violation.actualRestHours ?? 0),
    earlierStart: violation.earlierWindow?.startTime ?? "",
    earlierEnd: violation.earlierWindow?.endTime ?? "",
    laterStart: violation.laterWindow?.startTime ?? "",
    laterEnd: violation.laterWindow?.endTime ?? "",
  });
}

export function findBulkShiftDayComplianceViolation(
  shiftDate: string,
  countryCode: string,
  modalRows: readonly BulkShiftRowLike[],
  organizationDayAssignments: readonly LocationDayAssignment[],
  currentAreaId: string,
  employeeNameById: ReadonlyMap<string, string>,
  translate: (
    key: string,
    params?: Record<string, string | number>
  ) => string
): string | null {
  const modalWindowsByEmployee = new Map<string, DayShiftTimeWindow[]>();
  const externalByEmployee = new Map<string, DayShiftTimeWindow[]>();

  for (const assignment of externalDayAssignmentsForBulkCompliance(
    organizationDayAssignments,
    currentAreaId
  )) {
    const windows = externalByEmployee.get(assignment.employeeId) ?? [];
    windows.push({
      startTime: assignment.startTime,
      endTime: assignment.endTime,
    });
    externalByEmployee.set(assignment.employeeId, windows);
  }

  for (const row of modalRows) {
    if (row.employeeId === EMPTY_EMPLOYEE_ID) continue;
    if (!areAreaCalendarShiftTimesComplete(row.startTime, row.endTime)) continue;

    const windows = modalWindowsByEmployee.get(row.employeeId) ?? [];
    windows.push({ startTime: row.startTime, endTime: row.endTime });
    modalWindowsByEmployee.set(row.employeeId, windows);
  }

  const employeeIds = new Set([
    ...modalWindowsByEmployee.keys(),
    ...externalByEmployee.keys(),
  ]);

  for (const employeeId of employeeIds) {
    const modalWindows = modalWindowsByEmployee.get(employeeId) ?? [];
    const externalWindows = externalByEmployee.get(employeeId) ?? [];
    const windows = [...modalWindows, ...externalWindows];
    if (windows.length === 0) continue;

    const result = validateEmployeeDayShiftAssignments({
      countryCode,
      shiftDate,
      weekday: weekdayIndexFromDate(shiftDate),
      windows,
    });

    if (!result.ok) {
      const employeeName = employeeNameById.get(employeeId) ?? employeeId;
      return formatBulkShiftComplianceViolationMessage(
        result,
        employeeName,
        windows,
        translate
      );
    }
  }

  return null;
}
