import type { PlanningShift } from "@/lib/planning-shift-card";
import { findServiceHourIdForShift, type AreaServiceHourRef } from "@/lib/location-staffing-client";
import {
  countActionableConfirmationStatusesByEmployee,
  isDashboardActionableConfirmationStatus,
  type DashboardActionableConfirmationStatus,
} from "@/lib/dashboard-confirmation-employee-dedupe";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export const DASHBOARD_DAY_CONFIRMATION_STATUSES = [
  "proposed",
  "confirmed",
  "requested",
  "pending",
  "rejected",
  "canceled",
  "unresolved",
] as const satisfies readonly ShiftConfirmationStatus[];

export const DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES = [
  "requested",
  "pending",
  "rejected",
  "canceled",
  "unresolved",
] as const satisfies readonly ShiftConfirmationStatus[];

export type DashboardDayConfirmationCounts = Record<ShiftConfirmationStatus, number>;

export function emptyDashboardDayConfirmationCounts(): DashboardDayConfirmationCounts {
  return {
    proposed: 0,
    confirmed: 0,
    requested: 0,
    pending: 0,
    rejected: 0,
    canceled: 0,
    unresolved: 0,
  };
}

export function resolveShiftConfirmationStatusForCount(
  status: ShiftConfirmationStatus | undefined | null
): ShiftConfirmationStatus {
  return status ?? "confirmed";
}

export function aggregateConfirmationCountsForDay(
  shifts: readonly PlanningShift[],
  dateISO: string,
  areaId?: string
): DashboardDayConfirmationCounts {
  return aggregateConfirmationCountsForDates(shifts, [dateISO], areaId);
}

export function aggregateConfirmationCountsForDates(
  shifts: readonly PlanningShift[],
  dateISOs: readonly string[],
  areaId?: string
): DashboardDayConfirmationCounts {
  const counts = emptyDashboardDayConfirmationCounts();
  const dateSet = new Set(dateISOs);

  for (const shift of shifts) {
    if (!dateSet.has(shift.shift_date)) continue;
    if (areaId !== undefined && shift.location_area_id !== areaId) continue;
    const status = resolveShiftConfirmationStatusForCount(shift.confirmationStatus);
    counts[status] += 1;
  }

  return counts;
}

export function hasActionableConfirmationCounts(
  counts: DashboardDayConfirmationCounts
): boolean {
  return DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES.some(
    (status) => counts[status] > 0
  );
}

function confirmationWindowGroupingKey(input: {
  shift: PlanningShift;
  areaId: string;
  serviceHours: readonly AreaServiceHourRef[];
}): string {
  const serviceHourId = findServiceHourIdForShift(
    input.serviceHours,
    input.areaId,
    input.shift.shift_date,
    input.shift.startTime,
    input.shift.endTime
  );
  if (serviceHourId) {
    return staffingWindowConfirmationCountsKey(
      input.shift.shift_date,
      serviceHourId
    );
  }

  return staffingWindowConfirmationCountsKey(
    input.shift.shift_date,
    `employee:${input.shift.employee_id}`
  );
}

export function collectAreaConfirmationConflictStatuses(
  shifts: readonly PlanningShift[],
  areaId: string,
  dates: readonly string[],
  serviceHours: readonly AreaServiceHourRef[] | null | undefined = []
): DashboardActionableConfirmationStatus[] {
  const hours = serviceHours ?? [];
  const dateSet = new Set(dates);
  const present = new Set<ShiftConfirmationStatus>();
  const shiftsByWindow = new Map<string, PlanningShift[]>();

  for (const shift of shifts) {
    if (shift.location_area_id !== areaId) continue;
    if (!dateSet.has(shift.shift_date)) continue;
    if (!isDashboardActionableConfirmationStatus(shift.confirmationStatus)) {
      continue;
    }

    const key = confirmationWindowGroupingKey({
      shift,
      areaId,
      serviceHours: hours,
    });
    const windowShifts = shiftsByWindow.get(key) ?? [];
    windowShifts.push(shift);
    shiftsByWindow.set(key, windowShifts);
  }

  for (const windowShifts of shiftsByWindow.values()) {
    for (const status of countActionableConfirmationStatusesByEmployee(
      windowShifts
    )) {
      present.add(status);
    }
  }

  return DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES.filter((status) =>
    present.has(status)
  );
}

export type DashboardStaffingWindowConfirmationCounts = Partial<
  Record<
    (typeof DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES)[number],
    number
  >
>;

export function staffingWindowConfirmationCountsKey(
  dateISO: string,
  serviceHourId: string
): string {
  return `${dateISO}:${serviceHourId}`;
}

export function buildStaffingWindowConfirmationCountsByKey(input: {
  shifts: readonly PlanningShift[];
  areaId: string;
  dates: readonly string[];
  serviceHours: readonly AreaServiceHourRef[] | null | undefined;
}): Map<string, DashboardStaffingWindowConfirmationCounts> {
  const { shifts, areaId, dates } = input;
  const hours = input.serviceHours ?? [];
  const dateSet = new Set(dates);
  const result = new Map<string, DashboardStaffingWindowConfirmationCounts>();

  const shiftsByWindow = new Map<string, PlanningShift[]>();

  for (const shift of shifts) {
    if (shift.location_area_id !== areaId) continue;
    if (!dateSet.has(shift.shift_date)) continue;
    if (!isDashboardActionableConfirmationStatus(shift.confirmationStatus)) {
      continue;
    }

    const serviceHourId = findServiceHourIdForShift(
      hours,
      areaId,
      shift.shift_date,
      shift.startTime,
      shift.endTime
    );
    if (!serviceHourId) continue;

    const key = staffingWindowConfirmationCountsKey(
      shift.shift_date,
      serviceHourId
    );
    const windowShifts = shiftsByWindow.get(key) ?? [];
    windowShifts.push(shift);
    shiftsByWindow.set(key, windowShifts);
  }

  for (const [key, windowShifts] of shiftsByWindow) {
    const counts: DashboardStaffingWindowConfirmationCounts = {};
    for (const status of countActionableConfirmationStatusesByEmployee(
      windowShifts
    )) {
      counts[status] = (counts[status] ?? 0) + 1;
    }
    result.set(key, counts);
  }

  return result;
}

export function listStaffingWindowConfirmationStatuses(
  counts: DashboardStaffingWindowConfirmationCounts | undefined
): (typeof DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES)[number][] {
  if (!counts) return [];
  return DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES.filter(
    (status) => (counts[status] ?? 0) > 0
  );
}
