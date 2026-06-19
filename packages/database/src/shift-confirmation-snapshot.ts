import type { ShiftConfirmationStatus } from "@schichtwerk/types";

/** Felder, die beim Versand als Snapshot gespeichert werden (Spec 008 §5.7). */
export type ShiftConfirmationSnapshot = {
  employee_id: string;
  location_id: string | null;
  location_area_id: string | null;
  area_shift_template_id: string | null;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
};

export type ShiftConfirmationSnapshotSource = {
  employee_id: string;
  location_id: string | null;
  location_area_id: string | null;
  area_shift_template_id: string | null;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
};

const SNAPSHOT_STATUSES_REQUIRING_RESET: ReadonlySet<ShiftConfirmationStatus> =
  new Set(["requested", "confirmed", "rejected", "pending", "canceled"]);

export function buildShiftConfirmationSnapshot(
  shift: ShiftConfirmationSnapshotSource
): ShiftConfirmationSnapshot {
  return {
    employee_id: shift.employee_id,
    location_id: shift.location_id,
    location_area_id: shift.location_area_id,
    area_shift_template_id: shift.area_shift_template_id,
    shift_date: shift.shift_date,
    starts_at: shift.starts_at,
    ends_at: shift.ends_at,
    notes: shift.notes,
  };
}

export function shiftConfirmationSnapshotsEqual(
  a: ShiftConfirmationSnapshot,
  b: ShiftConfirmationSnapshot
): boolean {
  return (
    a.employee_id === b.employee_id &&
    a.location_id === b.location_id &&
    a.location_area_id === b.location_area_id &&
    a.area_shift_template_id === b.area_shift_template_id &&
    a.shift_date === b.shift_date &&
    a.starts_at === b.starts_at &&
    a.ends_at === b.ends_at &&
    a.notes === b.notes
  );
}

export function isShiftConfirmationSnapshotStale(
  snapshot: ShiftConfirmationSnapshot,
  shift: ShiftConfirmationSnapshotSource
): boolean {
  return !shiftConfirmationSnapshotsEqual(
    snapshot,
    buildShiftConfirmationSnapshot(shift)
  );
}

/** Planänderung setzt Status zurück auf proposed (Spec §3.1). */
export function shouldResetConfirmationToProposed(
  currentStatus: ShiftConfirmationStatus
): boolean {
  return SNAPSHOT_STATUSES_REQUIRING_RESET.has(currentStatus);
}
