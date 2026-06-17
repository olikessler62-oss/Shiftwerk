import { describe, expect, it } from "vitest";
import {
  absenceRangeForShiftConflict,
  absenceRangesOverlap,
  findOverlappingAbsence,
  isDateWithinAbsenceRange,
  validateAbsenceDateOrder,
} from "./absence-validation";

describe("validateAbsenceDateOrder", () => {
  it("allows open-ended sick without end date", () => {
    expect(validateAbsenceDateOrder("2026-06-01", null, true)).toEqual({
      ok: true,
    });
  });

  it("requires end date when not open-ended", () => {
    expect(validateAbsenceDateOrder("2026-06-01", null, false)).toEqual({
      ok: false,
      code: "missingEnd",
    });
  });
});

describe("isDateWithinAbsenceRange", () => {
  it("treats open-ended absence as ongoing from start date", () => {
    expect(
      isDateWithinAbsenceRange(
        {
          employee_id: "emp-1",
          start_date: "2026-06-01",
          end_date: null,
          is_open_ended: true,
        },
        "2026-12-31"
      )
    ).toBe(true);
  });

  it("returns false before open-ended start", () => {
    expect(
      isDateWithinAbsenceRange(
        {
          employee_id: "emp-1",
          start_date: "2026-06-01",
          end_date: null,
          is_open_ended: true,
        },
        "2026-05-31"
      )
    ).toBe(false);
  });
});

describe("absenceRangesOverlap", () => {
  it("detects overlap with open-ended range", () => {
    const openEnded = {
      employee_id: "emp-1",
      start_date: "2026-06-10",
      end_date: null,
      is_open_ended: true,
    };
    const closed = {
      employee_id: "emp-1",
      start_date: "2026-06-01",
      end_date: "2026-06-15",
    };
    expect(absenceRangesOverlap(openEnded, closed)).toBe(true);
  });

  it("ignores different employees", () => {
    expect(
      absenceRangesOverlap(
        {
          employee_id: "emp-1",
          start_date: "2026-06-01",
          end_date: "2026-06-30",
        },
        {
          employee_id: "emp-2",
          start_date: "2026-06-01",
          end_date: "2026-06-30",
        }
      )
    ).toBe(false);
  });
});

describe("findOverlappingAbsence", () => {
  it("excludes current id when editing", () => {
    const existing = [
      {
        id: "abs-1",
        employee_id: "emp-1",
        start_date: "2026-06-01",
        end_date: "2026-06-10",
      },
    ];
    const candidate = {
      id: "abs-1",
      employee_id: "emp-1",
      start_date: "2026-06-01",
      end_date: "2026-06-10",
    };
    expect(findOverlappingAbsence(existing, candidate, "abs-1")).toBeNull();
  });
});

describe("absenceRangeForShiftConflict", () => {
  it("caps open-ended range at reference date + horizon", () => {
    expect(
      absenceRangeForShiftConflict(
        {
          employee_id: "emp-1",
          start_date: "2026-06-01",
          end_date: null,
          is_open_ended: true,
        },
        "2026-06-05"
      )
    ).toEqual({
      employee_id: "emp-1",
      start_date: "2026-06-01",
      end_date: "2026-09-03",
    });
  });
});
