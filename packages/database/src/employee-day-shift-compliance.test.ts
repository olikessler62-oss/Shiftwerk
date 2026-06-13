import { describe, expect, it } from "vitest";
import { validateEmployeeDayShiftAssignments } from "./employee-day-shift-compliance";

describe("validateEmployeeDayShiftAssignments (DE)", () => {
  const base = {
    countryCode: "DE",
    shiftDate: "2025-06-02",
    weekday: 0,
  };

  it("accepts two non-overlapping shifts within daily limit", () => {
    const result = validateEmployeeDayShiftAssignments({
      ...base,
      windows: [
        { startTime: "08:00", endTime: "12:00" },
        { startTime: "13:00", endTime: "17:00" },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("warns but accepts split duty when combined hours exceed hard maximum", () => {
    const result = validateEmployeeDayShiftAssignments({
      ...base,
      windows: [
        { startTime: "08:00", endTime: "14:00" },
        { startTime: "15:00", endTime: "21:00" },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.warnings.some((warning) => warning.includes("12") || warning.includes("10"))
      ).toBe(true);
    }
  });

  it("accepts split early and late duty windows totalling 16h", () => {
    const result = validateEmployeeDayShiftAssignments({
      ...base,
      windows: [
        { startTime: "00:00", endTime: "08:00" },
        { startTime: "12:00", endTime: "20:00" },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("warns when combined daily hours exceed regular maximum", () => {
    const result = validateEmployeeDayShiftAssignments({
      ...base,
      windows: [
        { startTime: "08:00", endTime: "13:00" },
        { startTime: "14:00", endTime: "18:00" },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((warning) => warning.includes("9 h"))).toBe(true);
    }
  });

  it("rejects single shift over maximum duration", () => {
    const result = validateEmployeeDayShiftAssignments({
      ...base,
      windows: [{ startTime: "08:00", endTime: "19:00" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("shift_duration");
    }
  });
});
