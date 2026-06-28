import type { PlanningShift } from "@/lib/planning-shift-card";
import { DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES } from "@/lib/dashboard-day-confirmation-counts";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export type DashboardActionableConfirmationStatus =
  (typeof DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES)[number];

const CONFLICT_STATUS_PRIORITY: Record<
  DashboardActionableConfirmationStatus,
  number
> = {
  requested: 1,
  pending: 2,
  unresolved: 3,
  canceled: 4,
  rejected: 5,
};

function normalizeShiftTimeLabel(time: string): string {
  return time.trim().slice(0, 5);
}

export function confirmationShiftEmployeeSlotKey(
  shift: Pick<PlanningShift, "employee_id" | "shift_date" | "startTime" | "endTime">
): string {
  return `${shift.employee_id}:${shift.shift_date}:${normalizeShiftTimeLabel(shift.startTime)}:${normalizeShiftTimeLabel(shift.endTime)}`;
}

export function isDashboardActionableConfirmationStatus(
  status: ShiftConfirmationStatus | undefined | null
): status is DashboardActionableConfirmationStatus {
  return (
    !!status &&
    (DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES as readonly string[]).includes(
      status
    )
  );
}

export function compareDashboardConfirmationConflictPriority(
  left: DashboardActionableConfirmationStatus,
  right: DashboardActionableConfirmationStatus
): number {
  return CONFLICT_STATUS_PRIORITY[left] - CONFLICT_STATUS_PRIORITY[right];
}

function pickPreferredConfirmationShift(
  current: PlanningShift,
  candidate: PlanningShift
): PlanningShift {
  const currentStatus = current.confirmationStatus;
  const candidateStatus = candidate.confirmationStatus;
  if (
    !isDashboardActionableConfirmationStatus(currentStatus) ||
    !isDashboardActionableConfirmationStatus(candidateStatus)
  ) {
    return current;
  }

  const priorityDelta = compareDashboardConfirmationConflictPriority(
    candidateStatus,
    currentStatus
  );
  if (priorityDelta > 0) return candidate;
  if (priorityDelta < 0) return current;

  const currentUpdatedAt = current.confirmationStatusUpdatedAt ?? "";
  const candidateUpdatedAt = candidate.confirmationStatusUpdatedAt ?? "";
  if (candidateUpdatedAt > currentUpdatedAt) return candidate;
  if (candidateUpdatedAt < currentUpdatedAt) return current;

  return candidate.id.localeCompare(current.id) > 0 ? candidate : current;
}

/** One actionable confirmation conflict per employee and shift time slot. */
export function dedupeConfirmationShiftsByEmployeeSlot(
  shifts: readonly PlanningShift[]
): PlanningShift[] {
  const bestBySlot = new Map<string, PlanningShift>();

  for (const shift of shifts) {
    if (!isDashboardActionableConfirmationStatus(shift.confirmationStatus)) {
      continue;
    }

    const slotKey = confirmationShiftEmployeeSlotKey(shift);
    const existing = bestBySlot.get(slotKey);
    bestBySlot.set(
      slotKey,
      existing ? pickPreferredConfirmationShift(existing, shift) : shift
    );
  }

  return [...bestBySlot.values()];
}

/** @deprecated Use {@link dedupeConfirmationShiftsByEmployeeSlot}. */
export const dedupeConfirmationShiftsByEmployee = dedupeConfirmationShiftsByEmployeeSlot;

export function countActionableConfirmationStatusesByEmployee(
  shifts: readonly PlanningShift[]
): DashboardActionableConfirmationStatus[] {
  return dedupeConfirmationShiftsByEmployeeSlot(shifts)
    .map((shift) => shift.confirmationStatus)
    .filter(isDashboardActionableConfirmationStatus);
}
