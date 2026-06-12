import { describe, expect, it } from "vitest";
import type { AbsenceRequest, ProfileRecurringAvailability } from "@schichtwerk/types";
import {
  employeeHasRecurringAvailabilityOnWeekday,
  employeeMatchesShiftAvailability,
  isEmployeeAbsentOnDate,
  validateEmployeeNotAbsentOnDate,
  validateEmployeeShiftAvailability,
} from "./shift-assign-eligibility";

const employeeId = "emp-1";

function absence(
  overrides: Partial<AbsenceRequest> = {}
): AbsenceRequest {
  return {
    id: "abs-1",
    organization_id: "org-1",
    employee_id: employeeId,
    type: "vacation",
    start_date: "2026-06-10",
    end_date: "2026-06-12",
    status: "approved",
    notes: null,
    reviewed_by: "mgr-1",
    ...overrides,
  };
}

function slot(
  overrides: Partial<ProfileRecurringAvailability> = {}
): ProfileRecurringAvailability {
  return {
    id: "slot-1",
    organization_id: "org-1",
    profile_id: employeeId,
    weekday: 2,
    start_time: "08:00:00",
    end_time: "16:00:00",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("isEmployeeAbsentOnDate", () => {
  it("returns true for approved absence on date", () => {
    expect(
      isEmployeeAbsentOnDate(employeeId, [absence()], "2026-06-11")
    ).toBe(true);
  });

  it("returns false outside absence range", () => {
    expect(
      isEmployeeAbsentOnDate(employeeId, [absence()], "2026-06-09")
    ).toBe(false);
  });

  it("ignores non-approved absences", () => {
    expect(
      isEmployeeAbsentOnDate(
        employeeId,
        [absence({ status: "pending" })],
        "2026-06-11"
      )
    ).toBe(false);
  });
});

describe("employeeMatchesShiftAvailability", () => {
  it("accepts shift fully inside availability slot", () => {
    expect(
      employeeMatchesShiftAvailability(
        employeeId,
        [slot()],
        2,
        "09:00",
        "15:00"
      )
    ).toBe(true);
  });

  it("rejects shift extending beyond availability", () => {
    expect(
      employeeMatchesShiftAvailability(
        employeeId,
        [slot()],
        2,
        "07:00",
        "15:00"
      )
    ).toBe(false);
  });

  it("rejects wrong weekday", () => {
    expect(
      employeeMatchesShiftAvailability(
        employeeId,
        [slot({ weekday: 1 })],
        2,
        "09:00",
        "15:00"
      )
    ).toBe(false);
  });
});

describe("employeeHasRecurringAvailabilityOnWeekday", () => {
  it("returns true when slot exists for weekday", () => {
    expect(
      employeeHasRecurringAvailabilityOnWeekday(employeeId, [slot()], 2)
    ).toBe(true);
  });

  it("returns false when no slot on weekday", () => {
    expect(
      employeeHasRecurringAvailabilityOnWeekday(employeeId, [slot()], 3)
    ).toBe(false);
  });
});

describe("validateEmployeeNotAbsentOnDate", () => {
  it("returns error when absent", () => {
    const result = validateEmployeeNotAbsentOnDate(
      employeeId,
      [absence()],
      "2026-06-11"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("abwesend");
    }
  });
});

describe("validateEmployeeShiftAvailability", () => {
  it("returns ok when shift fits slot", () => {
    expect(
      validateEmployeeShiftAvailability(
        employeeId,
        [slot()],
        2,
        "09:00",
        "15:00"
      ).ok
    ).toBe(true);
  });

  it("returns error when no weekday slot", () => {
    const result = validateEmployeeShiftAvailability(
      employeeId,
      [slot({ weekday: 1 })],
      2,
      "09:00",
      "15:00"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Wochentag");
    }
  });
});
