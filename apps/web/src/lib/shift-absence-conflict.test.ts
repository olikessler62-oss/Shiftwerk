import { describe, expect, it } from "vitest";
import type { AbsenceRequest } from "@schichtwerk/types";
import {
  collectShiftAbsenceConflicts,
  findShiftAbsenceConflict,
  isShiftInAbsenceConflict,
} from "@/lib/shift-absence-conflict";

function absence(overrides: Partial<AbsenceRequest> = {}): AbsenceRequest {
  return {
    id: "abs-1",
    organization_id: "org-1",
    employee_id: "emp-1",
    type: "vacation",
    start_date: "2026-06-10",
    end_date: "2026-06-12",
    is_open_ended: false,
    expected_end_date: null,
    status: "approved",
    notes: null,
    reviewed_by: null,
    reported_by: null,
    updated_at: "2026-06-10T08:00:00.000Z",
    ...overrides,
  };
}

describe("shift absence conflict", () => {
  it("detects overlap on approved absence days", () => {
    expect(
      isShiftInAbsenceConflict(
        { id: "s1", employeeId: "emp-1", shift_date: "2026-06-11" },
        [absence()]
      )
    ).toBe(true);
  });

  it("ignores pending absences", () => {
    expect(
      findShiftAbsenceConflict(
        { id: "s1", employeeId: "emp-1", shift_date: "2026-06-11" },
        [absence({ status: "pending" })]
      )
    ).toBeNull();
  });

  it("collects multiple conflicts sorted by date", () => {
    const conflicts = collectShiftAbsenceConflicts(
      [
        { id: "s2", employeeId: "emp-1", shift_date: "2026-06-12" },
        { id: "s1", employeeId: "emp-1", shift_date: "2026-06-10" },
      ],
      [absence()]
    );

    expect(conflicts.map((row) => row.shiftId)).toEqual(["s1", "s2"]);
  });
});
