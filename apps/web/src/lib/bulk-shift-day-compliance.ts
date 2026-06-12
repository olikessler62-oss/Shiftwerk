import { areDashboardShiftTimesComplete } from "@/lib/available-employees-for-shift";
import { DASHBOARD_EMPTY_EMPLOYEE_ID } from "@/components/dashboard/dashboard-add-shift-modal";
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
    return translate("dashboard.bulkShiftValidationShiftDuration", {
      name: employeeName,
      start: violation.shiftStartTime ?? "",
      end: violation.shiftEndTime ?? "",
      hours: formatHours(violation.shiftDurationHours ?? 0),
      limit: violation.limitHours ?? 10,
    });
  }

  if (violation.kind === "daily_hours") {
    return translate("dashboard.bulkShiftValidationDailyHours", {
      name: employeeName,
      total: formatHours(violation.totalHours ?? 0),
      limit: violation.limitHours ?? 8,
      spans: formatTimeSpans(windows),
    });
  }

  return translate("dashboard.bulkShiftValidationRestPeriod", {
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
  locationDayAssignments: readonly LocationDayAssignment[],
  currentAreaId: string,
  employeeNameById: ReadonlyMap<string, string>,
  translate: (
    key: string,
    params?: Record<string, string | number>
  ) => string
): string | null {
  const modalWindowsByEmployee = new Map<string, DayShiftTimeWindow[]>();

  for (const row of modalRows) {
    if (row.employeeId === DASHBOARD_EMPTY_EMPLOYEE_ID) continue;
    if (!areDashboardShiftTimesComplete(row.startTime, row.endTime)) continue;

    const windows = modalWindowsByEmployee.get(row.employeeId) ?? [];
    windows.push({ startTime: row.startTime, endTime: row.endTime });
    modalWindowsByEmployee.set(row.employeeId, windows);
  }

  for (const [employeeId, modalWindows] of modalWindowsByEmployee) {
    const externalWindows = locationDayAssignments
      .filter(
        (assignment) =>
          assignment.employeeId === employeeId &&
          assignment.locationAreaId !== currentAreaId &&
          areDashboardShiftTimesComplete(
            assignment.startTime,
            assignment.endTime
          )
      )
      .map((assignment) => ({
        startTime: assignment.startTime,
        endTime: assignment.endTime,
      }));

    const windows = [...modalWindows, ...externalWindows];
    const requiresDayLevelCheck =
      modalWindows.length >= 2 || windows.length >= 2;

    const result = validateEmployeeDayShiftAssignments({
      countryCode,
      shiftDate,
      weekday: weekdayIndexFromDate(shiftDate),
      windows: requiresDayLevelCheck ? windows : modalWindows,
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
