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
import { buildShiftTimestamps } from "./shift-timestamps";

const BERLIN = "Europe/Berlin";

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
  it("requires 11 hours between shifts on different calendar days", () => {
    const previous = buildShiftTimestamps("2025-06-04", "20:00", "23:00", BERLIN);
    const next = buildShiftTimestamps("2025-06-05", "08:00", "16:00", BERLIN);
    const result = validateRestPeriodForCountry({
      countryCode: "DE",
      timeZone: BERLIN,
      newStartsAt: next.starts_at,
      newEndsAt: next.ends_at,
      existingShifts: [
        {
          starts_at: previous.starts_at,
          ends_at: previous.ends_at,
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("accepts sufficient rest across calendar days", () => {
    const previous = buildShiftTimestamps("2025-06-04", "08:00", "16:00", BERLIN);
    const next = buildShiftTimestamps("2025-06-05", "08:00", "16:00", BERLIN);
    const result = validateRestPeriodForCountry({
      countryCode: "DE",
      timeZone: BERLIN,
      newStartsAt: next.starts_at,
      newEndsAt: next.ends_at,
      existingShifts: [
        {
          starts_at: previous.starts_at,
          ends_at: previous.ends_at,
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("accepts Sat 08–10 before Sun 08–10 (22h rest)", () => {
    const previous = buildShiftTimestamps("2026-06-13", "08:00", "10:00", BERLIN);
    const next = buildShiftTimestamps("2026-06-14", "08:00", "10:00", BERLIN);
    const result = validateRestPeriodForCountry({
      countryCode: "DE",
      timeZone: BERLIN,
      newShiftDate: "2026-06-14",
      newStartsAt: next.starts_at,
      newEndsAt: next.ends_at,
      existingShifts: [
        {
          shift_date: "2026-06-13",
          starts_at: previous.starts_at,
          ends_at: previous.ends_at,
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("reports conflicting shift details when rest is too short", () => {
    const previous = buildShiftTimestamps("2026-06-13", "20:00", "23:00", BERLIN);
    const next = buildShiftTimestamps("2026-06-14", "08:00", "10:00", BERLIN);
    const result = validateRestPeriodForCountry({
      countryCode: "DE",
      timeZone: BERLIN,
      newShiftDate: "2026-06-14",
      newStartsAt: next.starts_at,
      newEndsAt: next.ends_at,
      existingShifts: [
        {
          shift_date: "2026-06-13",
          starts_at: previous.starts_at,
          ends_at: previous.ends_at,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Konflikt mit Schicht");
      expect(result.error).toContain("2026-06-13");
    }
  });

  it("ignores gaps between duty windows on the same planning day", () => {
    const morning = buildShiftTimestamps("2025-06-05", "06:00", "08:00", BERLIN);
    const afternoon = buildShiftTimestamps("2025-06-05", "10:00", "12:00", BERLIN);
    const result = validateRestPeriodForCountry({
      countryCode: "DE",
      timeZone: BERLIN,
      newShiftDate: "2025-06-05",
      newStartsAt: morning.starts_at,
      newEndsAt: morning.ends_at,
      existingShifts: [
        {
          shift_date: "2025-06-05",
          starts_at: afternoon.starts_at,
          ends_at: afternoon.ends_at,
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("ignores pauses between duty windows on the same calendar day", () => {
    const morning = buildShiftTimestamps("2025-06-05", "08:00", "10:00", BERLIN);
    const afternoon = buildShiftTimestamps("2025-06-05", "12:00", "15:00", BERLIN);
    const result = validateRestPeriodForCountry({
      countryCode: "DE",
      timeZone: BERLIN,
      newStartsAt: morning.starts_at,
      newEndsAt: morning.ends_at,
      existingShifts: [
        {
          starts_at: afternoon.starts_at,
          ends_at: afternoon.ends_at,
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("allows afternoon duty after overnight tail ending the same morning", () => {
    const overnight = buildShiftTimestamps("2025-06-04", "22:00", "08:00", BERLIN);
    const afternoon = buildShiftTimestamps("2025-06-05", "12:00", "20:00", BERLIN);
    const result = validateRestPeriodForCountry({
      countryCode: "DE",
      timeZone: BERLIN,
      newStartsAt: afternoon.starts_at,
      newEndsAt: afternoon.ends_at,
      existingShifts: [
        {
          shift_date: "2025-06-04",
          starts_at: overnight.starts_at,
          ends_at: overnight.ends_at,
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
