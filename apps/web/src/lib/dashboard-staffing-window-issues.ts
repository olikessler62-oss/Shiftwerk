import {
  DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES,
  listStaffingWindowConfirmationStatuses,
  type DashboardStaffingWindowConfirmationCounts,
} from "@/lib/dashboard-day-confirmation-counts";
import { dedupeConfirmationShiftsByEmployee } from "@/lib/dashboard-confirmation-employee-dedupe";
import {
  staffingWindowRowHasUnconfirmedPlannedCoverage,
  type DashboardStaffingIssue,
  type DashboardStaffingWindowRow,
} from "@/lib/dashboard-area-week-stats";
import { staffingWindowRowShowsCandidatesButton } from "@/lib/dashboard-staffing-row-status";
import { findServiceHourIdForShift, type AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { PlanningShift } from "@/lib/planning-shift-card";
import {
  shiftCardContextMenuActions,
  type ShiftCardContextMenuAction,
  type ShiftCardContextMenuOptions,
} from "@/lib/shift-card-context-menu-actions";
import { canDeleteShift } from "@/lib/shift-deletion-policy";
import {
  createPlanningPastShiftChecker,
  planningMomentFromStaffingRow,
} from "@/lib/planning-past-shift-time";
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
  employeeColorById?: ReadonlyMap<string, string | null | undefined>;
  shiftConfirmationEnabled: boolean;
  pendingAfterMinutes?: number;
  readOnlyWeek: boolean;
  todayISO: string;
  timeZone: string;
  allowPastShiftChanges: boolean;
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
  context: Pick<
    DashboardStaffingWindowIssuesContext,
    "todayISO" | "allowPastShiftChanges" | "timeZone"
  >
): DashboardStaffingWindowRow | null {
  const checker = createPlanningPastShiftChecker(
    context.allowPastShiftChanges,
    context.timeZone
  );

  for (const row of rows) {
    if (
      staffingWindowRowShowsCandidatesButton(row, context.todayISO) &&
      !checker.isBlockedForPlanning(planningMomentFromStaffingRow(row))
    ) {
      return row;
    }
  }

  return null;
}

export function findFirstPlannedStaffingWindowRow(
  rows: readonly DashboardStaffingWindowRow[],
  context: Pick<
    DashboardStaffingWindowIssuesContext,
    "allowPastShiftChanges" | "timeZone"
  >
): DashboardStaffingWindowRow | null {
  const checker = createPlanningPastShiftChecker(
    context.allowPastShiftChanges,
    context.timeZone
  );

  for (const row of rows) {
    if (
      !checker.isBlockedForPlanning(planningMomentFromStaffingRow(row)) &&
      row.rowKind === "staffing_window" &&
      row.status === "planned"
    ) {
      return row;
    }
  }

  return null;
}

export function findFirstRowWithConfirmationStatus(
  rows: readonly DashboardStaffingWindowRow[],
  status: (typeof DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES)[number]
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
  if (shiftConfirmationEnabled && row.status === "planned") return true;
  if (
    shiftConfirmationEnabled &&
    staffingWindowRowHasUnconfirmedPlannedCoverage(row)
  ) {
    return true;
  }
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
  const checker = createPlanningPastShiftChecker(
    context.allowPastShiftChanges,
    context.timeZone
  );

  return {
    shiftDate: shift.shift_date,
    shiftStartTime: shift.startTime,
    isPastShiftDate: checker.isPastShiftDate,
    isShiftMomentInPast: checker.isShiftMomentInPast,
    displayState: shift.displayState,
    pendingAfterMinutes: context.pendingAfterMinutes,
  };
}

export function listShiftsForStaffingWindow(
  row: DashboardStaffingWindowRow,
  context: DashboardStaffingWindowIssuesContext
): PlanningShift[] {
  return context.calendarShifts
    .filter((shift) => {
      if (shift.location_area_id !== context.areaId) return false;
      if (shift.shift_date !== row.dateISO) return false;

      if (row.rowKind === "no_service_hours") {
        return true;
      }

      const serviceHourId = findServiceHourIdForShift(
        context.serviceHours,
        context.areaId,
        shift.shift_date,
        shift.startTime,
        shift.endTime
      );
      return serviceHourId === row.serviceHourId;
    })
    .sort(
      (left, right) =>
        left.startTime.localeCompare(right.startTime) ||
        (context.employeeNameById.get(left.employee_id) ?? "").localeCompare(
          context.employeeNameById.get(right.employee_id) ?? "",
          "de"
        )
    );
}

export function shiftOverviewActionsForShift(
  shift: PlanningShift,
  context: DashboardStaffingWindowIssuesContext
): readonly ShiftCardContextMenuAction[] {
  const confirmationActions = confirmationActionsForShift(shift, context);
  if (confirmationActions.length > 0) return confirmationActions;

  if (context.readOnlyWeek) return [];

  const menuOptions = shiftCardMenuOptions(shift, context);
  if (
    canDeleteShift({
      shiftDate: shift.shift_date,
      confirmationStatus: shift.confirmationStatus,
      requestedAt: shift.requestedAt,
      isPastShiftDate: menuOptions.isPastShiftDate,
      pendingAfterMinutes: context.pendingAfterMinutes,
    })
  ) {
    return ["delete"];
  }

  return [];
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
    if (!status) return false;
    if (status === "proposed") {
      return (
        row.status === "planned" ||
        staffingWindowRowHasUnconfirmedPlannedCoverage(row)
      );
    }
    return (
      DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES as readonly string[]
    ).includes(status);
  });

  const proposedShifts = actionableShifts.filter(
    (shift) => shift.confirmationStatus === "proposed"
  );
  const otherShifts = actionableShifts.filter(
    (shift) => shift.confirmationStatus !== "proposed"
  );

  return [...proposedShifts, ...dedupeConfirmationShiftsByEmployee(otherShifts)].sort(
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
