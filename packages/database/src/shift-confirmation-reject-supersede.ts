import type { ShiftConfirmationStatus } from "@schichtwerk/types";

import { shiftsOverlapIso } from "./shift-overlap";

export const OPEN_CONFIRMATION_SHIFT_STATUSES = [
  "requested",
  "pending",
] as const satisfies readonly ShiftConfirmationStatus[];

export type OpenConfirmationShiftStatus =
  (typeof OPEN_CONFIRMATION_SHIFT_STATUSES)[number];

export function isOpenConfirmationShiftStatus(
  status: ShiftConfirmationStatus | undefined | null
): status is OpenConfirmationShiftStatus {
  return status === "requested" || status === "pending";
}

export type ShiftRejectSupersedeCandidate = {
  id: string;
  employee_id: string;
  shift_date: string;
  location_area_id: string | null;
  starts_at: string;
  ends_at: string;
  confirmation_status: ShiftConfirmationStatus;
};

export function shouldSupersedeOpenConfirmationShiftOnReject(input: {
  rejectedShift: Pick<
    ShiftRejectSupersedeCandidate,
    | "id"
    | "employee_id"
    | "shift_date"
    | "location_area_id"
    | "starts_at"
    | "ends_at"
  >;
  candidate: ShiftRejectSupersedeCandidate;
}): boolean {
  const { rejectedShift, candidate } = input;
  if (candidate.id === rejectedShift.id) return false;
  if (candidate.employee_id !== rejectedShift.employee_id) return false;
  if (candidate.shift_date !== rejectedShift.shift_date) return false;
  if (candidate.location_area_id !== rejectedShift.location_area_id) return false;
  if (!isOpenConfirmationShiftStatus(candidate.confirmation_status)) return false;

  return shiftsOverlapIso(
    rejectedShift.starts_at,
    rejectedShift.ends_at,
    candidate.starts_at,
    candidate.ends_at
  );
}

export function listShiftIdsSupersededByReject(input: {
  rejectedShift: Pick<
    ShiftRejectSupersedeCandidate,
    | "id"
    | "employee_id"
    | "shift_date"
    | "location_area_id"
    | "starts_at"
    | "ends_at"
  >;
  sameDayShifts: readonly ShiftRejectSupersedeCandidate[];
}): string[] {
  return input.sameDayShifts
    .filter((candidate) =>
      shouldSupersedeOpenConfirmationShiftOnReject({
        rejectedShift: input.rejectedShift,
        candidate,
      })
    )
    .map((candidate) => candidate.id);
}
