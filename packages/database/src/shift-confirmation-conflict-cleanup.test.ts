import { describe, expect, it } from "vitest";

import {
  countFullConfirmationConflictCleanupItems,
  planConfirmationConflictCleanup,
  planDuplicateConfirmationShiftCleanup,
} from "./shift-confirmation-conflict-cleanup";

const rejectedShift = {
  id: "rejected",
  employee_id: "patricia",
  shift_date: "2026-06-28",
  location_area_id: "area-1",
  starts_at: "2026-06-28T06:00:00.000Z",
  ends_at: "2026-06-28T14:00:00.000Z",
  confirmation_status: "rejected" as const,
};

describe("planConfirmationConflictCleanup", () => {
  it("plans superseding open shifts that overlap a rejected shift", () => {
    expect(
      planConfirmationConflictCleanup([
        rejectedShift,
        {
          ...rejectedShift,
          id: "pending",
          confirmation_status: "pending",
        },
      ])
    ).toEqual([
      {
        supersededShiftId: "pending",
        rejectedShiftId: "rejected",
      },
    ]);
  });

  it("ignores unrelated employees and non-overlapping shifts", () => {
    expect(
      countFullConfirmationConflictCleanupItems([
        rejectedShift,
        {
          ...rejectedShift,
          id: "other-employee",
          employee_id: "other",
          confirmation_status: "pending",
        },
        {
          ...rejectedShift,
          id: "later",
          confirmation_status: "requested",
          starts_at: "2026-06-28T15:00:00.000Z",
          ends_at: "2026-06-28T18:00:00.000Z",
        },
      ])
    ).toBe(0);
  });
});

describe("planDuplicateConfirmationShiftCleanup", () => {
  it("removes duplicate records for the same person, slot, and status", () => {
    expect(
      planDuplicateConfirmationShiftCleanup([
        {
          ...rejectedShift,
          id: "rejected-older",
          confirmation_status_updated_at: "2026-07-01T10:00:00.000Z",
        },
        {
          ...rejectedShift,
          id: "rejected-newer",
          confirmation_status_updated_at: "2026-07-02T10:00:00.000Z",
        },
      ])
    ).toEqual([
      {
        duplicateShiftId: "rejected-older",
        keepShiftId: "rejected-newer",
      },
    ]);
  });

  it("counts supersede and duplicate fixes together", () => {
    expect(
      countFullConfirmationConflictCleanupItems([
        rejectedShift,
        {
          ...rejectedShift,
          id: "pending",
          confirmation_status: "pending",
        },
        {
          ...rejectedShift,
          id: "rejected-duplicate",
          confirmation_status_updated_at: "2026-07-01T09:00:00.000Z",
        },
      ])
    ).toBe(2);
  });
});
