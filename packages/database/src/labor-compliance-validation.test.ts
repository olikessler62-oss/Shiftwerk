import { describe, expect, it } from "vitest";
import {
  centeredBreakForShift,
  validateShiftTypeBreaks,
} from "./shift-type-break-rules";
import {
  validateAvailabilityForCountry,
  validateRestPeriodForCountry,
  validateShiftDurationForCountry,
  validateShiftTypeBreaksForCountry,
} from "./labor-compliance-validation";

describe("validateShiftDurationForCountry (DE)", () => {
  const base = {
    countryCode: "DE",
    start_time: "08:00",
    end_time: "16:00",
    weekday: 0,
    point: "shift_assign" as const,
  };

  it("accepts 8-hour workday shift", () => {
    const result = validateShiftDurationForCountry(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toEqual([]);
  });

  it("warns on 9-hour shift (extended daily limit)", () => {
    const result = validateShiftDurationForCountry({
      ...base,
      end_time: "17:00",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.includes("10 h"))).toBe(true);
    }
  });

  it("rejects shifts over 10 hours", () => {
    const result = validateShiftDurationForCountry({
      ...base,
      end_time: "19:00",
    });
    expect(result.ok).toBe(false);
  });

  it("warns on Sunday", () => {
    const result = validateShiftDurationForCountry({
      ...base,
      weekday: 6,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.includes("Sonntag"))).toBe(true);
    }
  });

  it("warns on public holidays when shiftDate is set", () => {
    const result = validateShiftDurationForCountry({
      ...base,
      shiftDate: "2025-12-25",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.includes("Weihnachtstag"))).toBe(true);
    }
  });
});

describe("validateRestPeriodForCountry (DE)", () => {
  it("requires 11 hours between shifts", () => {
    const result = validateRestPeriodForCountry({
      countryCode: "DE",
      newStartsAt: "2025-06-05T08:00:00.000Z",
      newEndsAt: "2025-06-05T16:00:00.000Z",
      existingShifts: [
        {
          starts_at: "2025-06-04T20:00:00.000Z",
          ends_at: "2025-06-04T23:00:00.000Z",
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("accepts sufficient rest", () => {
    const result = validateRestPeriodForCountry({
      countryCode: "DE",
      newStartsAt: "2025-06-05T08:00:00.000Z",
      newEndsAt: "2025-06-05T16:00:00.000Z",
      existingShifts: [
        {
          starts_at: "2025-06-04T08:00:00.000Z",
          ends_at: "2025-06-04T16:00:00.000Z",
        },
      ],
    });
    expect(result.ok).toBe(true);
  });
});

describe("validateShiftTypeBreaksForCountry (DE)", () => {
  it("requires 30 minutes break for 8-hour shift", () => {
    const withoutBreak = validateShiftTypeBreaksForCountry(
      "DE",
      "08:00",
      "16:00",
      []
    );
    expect(withoutBreak.ok).toBe(false);

    const { break_start, break_end } = centeredBreakForShift("08:00", "16:00", 30);
    const withBreak = validateShiftTypeBreaksForCountry("DE", "08:00", "16:00", [
      { break_start, break_end },
    ]);
    expect(withBreak.ok).toBe(true);
  });

  it("delegates through validateShiftTypeBreaks wrapper", () => {
    const { break_start, break_end } = centeredBreakForShift("08:00", "16:00", 30);
    expect(
      validateShiftTypeBreaks("08:00", "16:00", [{ break_start, break_end }], "DE").ok
    ).toBe(true);
  });
});

describe("validateAvailabilityForCountry", () => {
  it("does not enforce shift duration on availability windows", () => {
    const result = validateAvailabilityForCountry({
      countryCode: "DE",
      weekday: 0,
      start_time: "06:00",
      end_time: "22:00",
    });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
