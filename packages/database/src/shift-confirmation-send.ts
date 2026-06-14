import type {
  ConfirmationRequestScope,
  NotificationOutboxChannel,
  Profile,
  ShiftConfirmationStatus,
} from "@schichtwerk/types";
import {
  buildShiftConfirmationSnapshot,
  isShiftConfirmationSnapshotStale,
  type ShiftConfirmationSnapshot,
  type ShiftConfirmationSnapshotSource,
} from "./shift-confirmation-snapshot";
import { profileEligibleForShiftConfirmationAssignment } from "./shift-confirmation-assign";

export type ProposedShiftForSend = ShiftConfirmationSnapshotSource & {
  id: string;
  organization_id: string;
  confirmation_status?: ShiftConfirmationStatus;
};

export function isoWeekEndFromWeekStart(weekStartISO: string): string {
  const [y, m, d] = weekStartISO.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  end.setDate(end.getDate() + 6);
  const year = end.getFullYear();
  const month = String(end.getMonth() + 1).padStart(2, "0");
  const day = String(end.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isShiftProposedForSend(
  shift: Pick<ProposedShiftForSend, "confirmation_status">
): boolean {
  return shift.confirmation_status === "proposed";
}

export function isShiftEligibleForConfirmationSend(
  shift: ProposedShiftForSend,
  profile: Pick<Profile, "id" | "app_registered_at" | "email_fallback_mode">
): boolean {
  return (
    shift.employee_id === profile.id &&
    isShiftProposedForSend(shift) &&
    profileEligibleForShiftConfirmationAssignment(profile)
  );
}

export function filterShiftsForConfirmationSendScope(
  shifts: readonly ProposedShiftForSend[],
  scope: ConfirmationRequestScope,
  options: {
    employeeId: string;
    shiftDate?: string;
    shiftId?: string;
  }
): ProposedShiftForSend[] {
  const proposed = shifts.filter(isShiftProposedForSend);

  switch (scope) {
    case "single_shift":
      return options.shiftId
        ? proposed.filter((shift) => shift.id === options.shiftId)
        : [];
    case "employee_day":
      return options.shiftDate
        ? proposed.filter(
            (shift) =>
              shift.employee_id === options.employeeId &&
              shift.shift_date === options.shiftDate
          )
        : [];
    case "employee_week":
    case "bulk_week":
      return proposed.filter((shift) => shift.employee_id === options.employeeId);
    default:
      return [];
  }
}

export function confirmationBatchIsDelta(
  shifts: readonly ProposedShiftForSend[],
  latestSnapshots: ReadonlyMap<string, ShiftConfirmationSnapshot>
): boolean {
  return shifts.some((shift) => latestSnapshots.has(shift.id));
}

export function resolveConfirmationNotificationTemplateKey(isDelta: boolean): string {
  return isDelta ? "confirmation_request_delta" : "confirmation_request_week";
}

export function resolveConfirmationNotificationChannel(
  profile: Pick<Profile, "email_fallback_mode">
): NotificationOutboxChannel {
  return profile.email_fallback_mode ? "email" : "push";
}

export function shiftToConfirmationSnapshot(
  shift: ShiftConfirmationSnapshotSource
): ShiftConfirmationSnapshot {
  return buildShiftConfirmationSnapshot(shift);
}

export function parseStoredConfirmationSnapshot(
  value: unknown
): ShiftConfirmationSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const required = [
    "employee_id",
    "shift_date",
    "starts_at",
    "ends_at",
  ] as const;
  for (const key of required) {
    if (typeof row[key] !== "string") return null;
  }
  return {
    employee_id: row.employee_id as string,
    location_id: (row.location_id as string | null) ?? null,
    location_area_id: (row.location_area_id as string | null) ?? null,
    area_shift_template_id: (row.area_shift_template_id as string | null) ?? null,
    shift_date: row.shift_date as string,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    notes: (row.notes as string | null) ?? null,
  };
}

/** Schicht ist sendbar wenn proposed (Delta = erneut proposed nach Planänderung). */
export function isSendableProposedShift(
  shift: ProposedShiftForSend,
  latestSnapshots: ReadonlyMap<string, ShiftConfirmationSnapshot>
): boolean {
  if (!isShiftProposedForSend(shift)) return false;
  const prior = latestSnapshots.get(shift.id);
  if (!prior) return true;
  return isShiftConfirmationSnapshotStale(prior, shift);
}

export function filterSendableProposedShifts(
  shifts: readonly ProposedShiftForSend[],
  latestSnapshots: ReadonlyMap<string, ShiftConfirmationSnapshot>
): ProposedShiftForSend[] {
  return shifts.filter((shift) => isSendableProposedShift(shift, latestSnapshots));
}
