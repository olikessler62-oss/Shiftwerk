import { describe, expect, it } from "vitest";
import {
  absenceDeleteShiftConflictRange,
  absenceDeleteShiftConflictRangeFromRequest,
  wouldDeletingAbsenceConflictWithFutureShifts,
} from "./absence-delete-shift-validation";
import { PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR } from "./profile-availability-delete-validation";

describe("absenceDeleteShiftConflictRange", () => {
  it("clips past absence start to today", () => {
    expect(
      absenceDeleteShiftConflictRange(
        {
          employee_id: "emp-1",
          start_date: "2026-06-01",
          end_date: "2026-06-20",
        },
        "2026-06-10"
      )
    ).toEqual({
      employee_id: "emp-1",
      start_date: "2026-06-10",
      end_date: "2026-06-20",
    });
  });

  it("returns null when absence ends before today", () => {
    expect(
      absenceDeleteShiftConflictRange(
        {
          employee_id: "emp-1",
          start_date: "2026-06-01",
          end_date: "2026-06-09",
        },
        "2026-06-10"
      )
    ).toBeNull();
  });

  it("builds future range for open-ended sick leave", () => {
    expect(
      absenceDeleteShiftConflictRangeFromRequest(
        {
          employee_id: "emp-1",
          start_date: "2026-06-10",
          end_date: null,
          is_open_ended: true,
        },
        "2026-06-10"
      )
    ).toEqual({
      employee_id: "emp-1",
      start_date: "2026-06-10",
      end_date: "2026-09-08",
    });
  });
});

describe("wouldDeletingAbsenceConflictWithFutureShifts", () => {
  it("blocks delete when shifts exist", () => {
    expect(
      wouldDeletingAbsenceConflictWithFutureShifts({
        absence: {
          employee_id: "emp-1",
          start_date: "2026-06-10",
          end_date: "2026-06-12",
          is_open_ended: false,
        },
        shiftCount: 2,
      })
    ).toEqual({
      ok: false,
      error: PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR,
    });
  });

  it("allows delete when no shifts exist", () => {
    expect(
      wouldDeletingAbsenceConflictWithFutureShifts({
        absence: {
          employee_id: "emp-1",
          start_date: "2026-06-10",
          end_date: "2026-06-12",
          is_open_ended: false,
        },
        shiftCount: 0,
      })
    ).toEqual({ ok: true });
  });
});
