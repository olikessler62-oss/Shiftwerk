import { describe, expect, it } from "vitest";
import {
  formatWeeklyHoursExceededError,
  isoWeekStartFromShiftDate,
  resolveProfileWeeklyHoursTarget,
  sumEmployeeWeekHours,
  validateEmployeeWeeklyHoursAfterAssign,
} from "./employee-weekly-hours-validation";

describe("employee weekly hours validation", () => {
  const weekStart = "2026-06-08";

  it("resolves default weekly hours target", () => {
    expect(resolveProfileWeeklyHoursTarget(null)).toBe(40);
    expect(resolveProfileWeeklyHoursTarget(38)).toBe(38);
  });

  it("sums existing and proposed windows within the same ISO week", () => {
    const total = sumEmployeeWeekHours({
      weekStart,
      existingShifts: [
        {
          id: "s1",
          shift_date: "2026-06-09",
          starts_at: "2026-06-09T05:00:00.000Z",
          ends_at: "2026-06-09T13:00:00.000Z",
          startTime: "08:00",
          endTime: "17:00",
          breaks: [{ break_start: "13:00", break_end: "14:00" }],
        },
      ],
      additionalWindows: [
        { shiftDate: "2026-06-10", startTime: "09:00", endTime: "17:00" },
      ],
    });

    expect(total).toBe(16);
  });

  it("rejects assignment when weekly target would be exceeded", () => {
    const result = validateEmployeeWeeklyHoursAfterAssign({
      targetHours: 40,
      weekStart,
      existingShifts: ["2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13"].map(
        (shiftDate, index) => ({
          id: `s-${index}`,
          shift_date: shiftDate,
          starts_at: `${shiftDate}T05:00:00.000Z`,
          ends_at: `${shiftDate}T13:00:00.000Z`,
        })
      ),
      proposedWindows: [{ shiftDate: "2026-06-14", startTime: "09:00", endTime: "17:00" }],
      employeeName: "Anna",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        formatWeeklyHoursExceededError({
          employeeName: "Anna",
          weekTotal: 48,
          targetHours: 40,
        })
      );
    }
  });

  it("excludes replaced shift ids from the week total", () => {
    const result = validateEmployeeWeeklyHoursAfterAssign({
      targetHours: 40,
      weekStart,
      existingShifts: [
        {
          id: "old",
          shift_date: "2026-06-09",
          starts_at: "2026-06-09T05:00:00.000Z",
          ends_at: "2026-06-09T13:00:00.000Z",
        },
      ],
      excludeShiftIds: new Set(["old"]),
      proposedWindows: [{ shiftDate: "2026-06-09", startTime: "10:00", endTime: "18:00" }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.weekTotal).toBe(8);
    }
  });

  it("computes ISO week start from shift date", () => {
    expect(isoWeekStartFromShiftDate("2026-06-11")).toBe("2026-06-08");
  });
});
