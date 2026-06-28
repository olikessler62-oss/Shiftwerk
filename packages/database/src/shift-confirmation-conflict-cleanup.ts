import type { ShiftConfirmationStatus } from "@schichtwerk/types";

import {
  listShiftIdsSupersededByReject,
  type ShiftRejectSupersedeCandidate,
} from "./shift-confirmation-reject-supersede";

export type ConfirmationShiftCleanupRecord = ShiftRejectSupersedeCandidate & {
  confirmation_status_updated_at?: string | null;
};

export type ConfirmationConflictCleanupItem = {
  supersededShiftId: string;
  rejectedShiftId: string;
};

export type DuplicateConfirmationShiftCleanupItem = {
  duplicateShiftId: string;
  keepShiftId: string;
};

export type FullConfirmationConflictCleanupPlan = {
  supersede: ConfirmationConflictCleanupItem[];
  removeDuplicates: DuplicateConfirmationShiftCleanupItem[];
};

const DUPLICATE_CLEANUP_STATUSES = new Set<ShiftConfirmationStatus>([
  "requested",
  "pending",
  "rejected",
  "canceled",
  "unresolved",
]);

function groupShiftsByEmployeeDay(
  shifts: readonly ShiftRejectSupersedeCandidate[]
): Map<string, ShiftRejectSupersedeCandidate[]> {
  const grouped = new Map<string, ShiftRejectSupersedeCandidate[]>();

  for (const shift of shifts) {
    const key = `${shift.employee_id}:${shift.shift_date}`;
    const list = grouped.get(key) ?? [];
    list.push(shift);
    grouped.set(key, list);
  }

  return grouped;
}

function duplicateShiftSlotKey(
  shift: Pick<
    ConfirmationShiftCleanupRecord,
    | "employee_id"
    | "shift_date"
    | "location_area_id"
    | "starts_at"
    | "ends_at"
    | "confirmation_status"
  >
): string {
  return [
    shift.employee_id,
    shift.shift_date,
    shift.location_area_id ?? "",
    shift.starts_at,
    shift.ends_at,
    shift.confirmation_status,
  ].join(":");
}

/** Offene Bestätigungen (angefragt/ausstehend), die einer abgelehnten Schicht widersprechen. */
export function planConfirmationConflictCleanup(
  shifts: readonly ShiftRejectSupersedeCandidate[]
): ConfirmationConflictCleanupItem[] {
  const planned: ConfirmationConflictCleanupItem[] = [];
  const supersededIds = new Set<string>();

  for (const sameDayShifts of groupShiftsByEmployeeDay(shifts).values()) {
    const rejectedShifts = sameDayShifts.filter(
      (shift) => shift.confirmation_status === "rejected"
    );
    if (!rejectedShifts.length) continue;

    for (const rejectedShift of rejectedShifts) {
      for (const supersededShiftId of listShiftIdsSupersededByReject({
        rejectedShift,
        sameDayShifts,
      })) {
        if (supersededIds.has(supersededShiftId)) continue;
        supersededIds.add(supersededShiftId);
        planned.push({
          supersededShiftId,
          rejectedShiftId: rejectedShift.id,
        });
      }
    }
  }

  return planned;
}

/** Doppelte Schicht-Datensätze (gleiche Person, Zeitraum, Status). */
export function planDuplicateConfirmationShiftCleanup(
  shifts: readonly ConfirmationShiftCleanupRecord[]
): DuplicateConfirmationShiftCleanupItem[] {
  const grouped = new Map<string, ConfirmationShiftCleanupRecord[]>();

  for (const shift of shifts) {
    if (!DUPLICATE_CLEANUP_STATUSES.has(shift.confirmation_status)) continue;
    const key = duplicateShiftSlotKey(shift);
    const list = grouped.get(key) ?? [];
    list.push(shift);
    grouped.set(key, list);
  }

  const planned: DuplicateConfirmationShiftCleanupItem[] = [];
  const duplicateIds = new Set<string>();

  for (const group of grouped.values()) {
    if (group.length < 2) continue;

    const sorted = [...group].sort((left, right) => {
      const leftUpdated = left.confirmation_status_updated_at ?? "";
      const rightUpdated = right.confirmation_status_updated_at ?? "";
      if (rightUpdated !== leftUpdated) {
        return rightUpdated.localeCompare(leftUpdated);
      }
      return right.id.localeCompare(left.id);
    });

    const keep = sorted[0];
    if (!keep) continue;

    for (const shift of sorted.slice(1)) {
      if (duplicateIds.has(shift.id)) continue;
      duplicateIds.add(shift.id);
      planned.push({
        duplicateShiftId: shift.id,
        keepShiftId: keep.id,
      });
    }
  }

  return planned;
}

export function planFullConfirmationConflictCleanup(
  shifts: readonly ConfirmationShiftCleanupRecord[]
): FullConfirmationConflictCleanupPlan {
  return {
    supersede: planConfirmationConflictCleanup(shifts),
    removeDuplicates: planDuplicateConfirmationShiftCleanup(shifts),
  };
}

export function countConfirmationConflictCleanupItems(
  shifts: readonly ShiftRejectSupersedeCandidate[]
): number {
  return planConfirmationConflictCleanup(shifts).length;
}

export function countFullConfirmationConflictCleanupItems(
  shifts: readonly ConfirmationShiftCleanupRecord[]
): number {
  const plan = planFullConfirmationConflictCleanup(shifts);
  return plan.supersede.length + plan.removeDuplicates.length;
}
