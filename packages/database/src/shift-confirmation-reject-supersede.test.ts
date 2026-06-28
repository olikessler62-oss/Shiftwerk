import { describe, expect, it } from "vitest";

import {
  listShiftIdsSupersededByReject,
  shouldSupersedeOpenConfirmationShiftOnReject,
} from "./shift-confirmation-reject-supersede";

const rejectedShift = {
  id: "shift-rejected",
  employee_id: "emp-1",
  shift_date: "2026-06-28",
  location_area_id: "area-1",
  starts_at: "2026-06-28T06:00:00.000Z",
  ends_at: "2026-06-28T14:00:00.000Z",
};

describe("shouldSupersedeOpenConfirmationShiftOnReject", () => {
  it("supersedes overlapping pending shifts for the same employee", () => {
    expect(
      shouldSupersedeOpenConfirmationShiftOnReject({
        rejectedShift,
        candidate: {
          ...rejectedShift,
          id: "shift-pending",
          confirmation_status: "pending",
        },
      })
    ).toBe(true);
  });

  it("ignores rejected or non-overlapping shifts", () => {
    expect(
      shouldSupersedeOpenConfirmationShiftOnReject({
        rejectedShift,
        candidate: {
          ...rejectedShift,
          id: "shift-other-rejected",
          confirmation_status: "rejected",
        },
      })
    ).toBe(false);

    expect(
      shouldSupersedeOpenConfirmationShiftOnReject({
        rejectedShift,
        candidate: {
          ...rejectedShift,
          id: "shift-later",
          confirmation_status: "pending",
          starts_at: "2026-06-28T15:00:00.000Z",
          ends_at: "2026-06-28T18:00:00.000Z",
        },
      })
    ).toBe(false);
  });
});

describe("listShiftIdsSupersededByReject", () => {
  it("returns only overlapping open confirmation shifts", () => {
    expect(
      listShiftIdsSupersededByReject({
        rejectedShift,
        sameDayShifts: [
          {
            ...rejectedShift,
            id: "shift-pending",
            confirmation_status: "pending",
          },
          {
            ...rejectedShift,
            id: "shift-requested",
            confirmation_status: "requested",
          },
          {
            ...rejectedShift,
            id: "shift-other-employee",
            employee_id: "emp-2",
            confirmation_status: "pending",
          },
        ],
      })
    ).toEqual(["shift-pending", "shift-requested"]);
  });
});
