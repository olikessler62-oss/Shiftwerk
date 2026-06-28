import {
  DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES,
  listStaffingWindowConfirmationStatuses,
  type DashboardStaffingWindowConfirmationCounts,
} from "@/lib/dashboard-day-confirmation-counts";
import { dedupeConfirmationShiftsByEmployee } from "@/lib/dashboard-confirmation-employee-dedupe";
import type {
  DashboardStaffingIssue,
  DashboardStaffingWindowRow,
} from "@/lib/dashboard-area-week-stats";
import { findServiceHourIdForShift, type AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { PlanningShift } from "@/lib/planning-shift-card";
import {
  shiftCardContextMenuActions,
  type ShiftCardContextMenuAction,
  type ShiftCardContextMenuOptions,
} from "@/lib/shift-card-context-menu-actions";
import { isPastCalendarDate } from "@/lib/dates";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export type DashboardStaffingWindowIssuesContext = {
  areaId: string;
  areaName: string;
  areaCalendarHref: string;
  weekStart: string;
  locationId: string;
  calendarShifts: readonly PlanningShift[];
  serviceHours: readonly AreaServiceHourRef[];
  employeeNameById: ReadonlyMap<string, string>;
  shiftConfirmationEnabled: boolean;
  readOnlyWeek: boolean;
  todayISO: string;
};

export type DashboardStaffingWindowIssueListItem =
  | {
      kind: "staffing";
      id: string;
      issue: DashboardStaffingIssue;
    }
  | {
      kind: "confirmation";
      id: string;
      shift: PlanningShift;
      employeeName: string;
      status: ShiftConfirmationStatus;
      actions: readonly ShiftCardContextMenuAction[];
    };

export function findFirstStaffingCandidatesRow(
  rows: readonly DashboardStaffingWindowRow[],
  todayISO: string
): DashboardStaffingWindowRow | null {
  for (const row of rows) {
    if (
      !isPastCalendarDate(row.dateISO, todayISO) &&
      row.rowKind === "staffing_window" &&
      (row.status === "understaffed" || row.status === "planned")
    ) {
      return row;
    }
  }

  return null;
}

export function findFirstRowWithConfirmationStatus(
  rows: readonly DashboardStaffingWindowRow[],
  status: ShiftConfirmationStatus
): DashboardStaffingWindowRow | null {
  for (const row of rows) {
    if ((row.confirmationCounts?.[status] ?? 0) > 0) {
      return row;
    }
  }

  return null;
}

export function filterStaffingWindowIssueListItemsByConfirmationStatus(
  items: readonly DashboardStaffingWindowIssueListItem[],
  status: ShiftConfirmationStatus | null
): DashboardStaffingWindowIssueListItem[] {
  if (!status) return [...items];

  return items.filter(
    (item) => item.kind === "confirmation" && item.status === status
  );
}

export function staffingRowShowsIssuesButton(
  row: DashboardStaffingWindowRow,
  shiftConfirmationEnabled: boolean
): boolean {
  if (row.rowKind !== "staffing_window") return false;
  if ((row.staffingConflicts?.length ?? 0) > 0) return true;
  if (
    shiftConfirmationEnabled &&
    listStaffingWindowConfirmationStatuses(row.confirmationCounts).length > 0
  ) {
    return true;
  }
  return false;
}

export function countStaffingWindowIssues(
  row: DashboardStaffingWindowRow,
  context: DashboardStaffingWindowIssuesContext
): number {
  return buildStaffingWindowIssueListItems(row, context).length;
}

function shiftCardMenuOptions(
  shift: PlanningShift,
  context: DashboardStaffingWindowIssuesContext
): ShiftCardContextMenuOptions {
  return {
    shiftDate: shift.shift_date,
    isPastShiftDate: (shiftDate) =>
      isPastCalendarDate(shiftDate, context.todayISO),
    displayState: shift.displayState,
  };
}

export function listConfirmationShiftsForStaffingWindow(
  row: DashboardStaffingWindowRow,
  context: DashboardStaffingWindowIssuesContext
): PlanningShift[] {
  const actionableShifts = context.calendarShifts.filter((shift) => {
    if (shift.location_area_id !== context.areaId) return false;
    if (shift.shift_date !== row.dateISO) return false;

    const serviceHourId = findServiceHourIdForShift(
      context.serviceHours,
      context.areaId,
      shift.shift_date,
      shift.startTime,
      shift.endTime
    );
    if (serviceHourId !== row.serviceHourId) return false;

    const status = shift.confirmationStatus;
    return (
      !!status &&
      (
        DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES as readonly string[]
      ).includes(status)
    );
  });

  return dedupeConfirmationShiftsByEmployee(actionableShifts).sort(
    (left, right) =>
      (context.employeeNameById.get(left.employee_id) ?? "").localeCompare(
        context.employeeNameById.get(right.employee_id) ?? "",
        "de"
      ) || left.startTime.localeCompare(right.startTime)
  );
}

export function confirmationActionsForShift(
  shift: PlanningShift,
  context: DashboardStaffingWindowIssuesContext
): readonly ShiftCardContextMenuAction[] {
  if (!context.shiftConfirmationEnabled || context.readOnlyWeek) return [];

  return shiftCardContextMenuActions(
    shift.confirmationStatus,
    shift.requestedAt,
    shiftCardMenuOptions(shift, context)
  );
}

export function buildStaffingWindowIssueListItems(
  row: DashboardStaffingWindowRow,
  context: DashboardStaffingWindowIssuesContext
): DashboardStaffingWindowIssueListItem[] {
  const items: DashboardStaffingWindowIssueListItem[] = [];

  for (const issue of row.staffingConflicts ?? []) {
    items.push({
      kind: "staffing",
      id: issue.id,
      issue,
    });
  }

  if (context.shiftConfirmationEnabled) {
    for (const shift of listConfirmationShiftsForStaffingWindow(row, context)) {
      const status = shift.confirmationStatus;
      if (!status) continue;

      const actions = confirmationActionsForShift(shift, context);
      items.push({
        kind: "confirmation",
        id: shift.id,
        shift,
        employeeName:
          context.employeeNameById.get(shift.employee_id) ?? "—",
        status,
        actions,
      });
    }
  }

  return items;
}

export function hasActionableStaffingWindowIssueItems(
  row: DashboardStaffingWindowRow,
  context: DashboardStaffingWindowIssuesContext
): boolean {
  return buildStaffingWindowIssueListItems(row, context).some(
    (item) => item.kind === "staffing" || item.actions.length > 0
  );
}

export function totalConfirmationCount(
  counts: DashboardStaffingWindowConfirmationCounts | undefined
): number {
  if (!counts) return 0;
  return listStaffingWindowConfirmationStatuses(counts).reduce(
    (sum, status) => sum + (counts[status] ?? 0),
    0
  );
}
