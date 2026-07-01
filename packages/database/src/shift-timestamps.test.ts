import { describe, expect, it } from "vitest";
import { buildShiftTimestamps, shiftTimeFromTimestamp } from "./shift-timestamps";

const BERLIN = "Europe/Berlin";
const VIENNA = "Europe/Vienna";

describe("shiftTimeFromTimestamp", () => {
  it("formats UTC timestamptz as Europe/Berlin local time", () => {
    expect(shiftTimeFromTimestamp("2025-06-05T07:00:00.000Z", BERLIN)).toBe(
      "09:00"
    );
    expect(shiftTimeFromTimestamp("2025-01-15T08:00:00.000Z", BERLIN)).toBe(
      "09:00"
    );
  });
});

describe("buildShiftTimestamps", () => {
  it("uses CEST offset in summer for Europe/Berlin", () => {
    const { starts_at, ends_at } = buildShiftTimestamps(
      "2025-06-05",
      "09:00",
      "17:00",
      BERLIN
    );
    expect(starts_at).toBe("2025-06-05T07:00:00.000Z");
    expect(ends_at).toBe("2025-06-05T15:00:00.000Z");
    expect(shiftTimeFromTimestamp(starts_at, BERLIN)).toBe("09:00");
    expect(shiftTimeFromTimestamp(ends_at, BERLIN)).toBe("17:00");
  });

  it("uses CET offset in winter for Europe/Berlin", () => {
    const { starts_at, ends_at } = buildShiftTimestamps(
      "2025-01-15",
      "09:00",
      "17:00",
      BERLIN
    );
    expect(starts_at).toBe("2025-01-15T08:00:00.000Z");
    expect(ends_at).toBe("2025-01-15T16:00:00.000Z");
    expect(shiftTimeFromTimestamp(starts_at, BERLIN)).toBe("09:00");
    expect(shiftTimeFromTimestamp(ends_at, BERLIN)).toBe("17:00");
  });

  it("round-trips overnight shifts", () => {
    const { starts_at, ends_at } = buildShiftTimestamps(
      "2025-06-05",
      "22:00",
      "06:00",
      BERLIN
    );
    expect(shiftTimeFromTimestamp(starts_at, BERLIN)).toBe("22:00");
    expect(shiftTimeFromTimestamp(ends_at, BERLIN)).toBe("06:00");
  });

  it("respects a different organization timezone", () => {
    const { starts_at } = buildShiftTimestamps(
      "2025-06-05",
      "09:00",
      "17:00",
      VIENNA
    );
    expect(shiftTimeFromTimestamp(starts_at, VIENNA)).toBe("09:00");
  });

  it("handles DST spring-forward gap in Europe/Berlin", () => {
    const { starts_at } = buildShiftTimestamps(
      "2025-03-30",
      "03:30",
      "04:30",
      BERLIN
    );
    expect(shiftTimeFromTimestamp(starts_at, BERLIN)).toBe("03:30");
  });

  it("round-trips across DST fall-back in Europe/Berlin", () => {
    const { starts_at, ends_at } = buildShiftTimestamps(
      "2025-10-26",
      "02:30",
      "03:30",
      BERLIN
    );
    expect(shiftTimeFromTimestamp(starts_at, BERLIN)).toBe("02:30");
    expect(shiftTimeFromTimestamp(ends_at, BERLIN)).toBe("03:30");
  });
});
