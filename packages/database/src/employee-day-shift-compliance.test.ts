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

  it("rejects combined daily hours over hard maximum", () => {
    const result = validateEmployeeDayShiftAssignments({
      ...base,
      windows: [
        { startTime: "08:00", endTime: "14:00" },
        { startTime: "15:00", endTime: "21:00" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("daily_hours");
      expect(result.totalHours).toBe(12);
      expect(result.limitHours).toBe(10);
    }
  });

  it("rejects combined daily hours over regular maximum with warning threshold", () => {
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
