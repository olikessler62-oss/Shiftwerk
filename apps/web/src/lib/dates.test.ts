import { describe, expect, it } from "vitest";
import {
  getISOWeek,
  parseISODate,
  startOfWeek,
  toISODate,
  weekDates,
} from "./dates";

describe("dates (UTC calendar)", () => {
  it("parseISODate is stable across server timezones", () => {
    const date = parseISODate("2026-06-16");
    expect(date.toISOString()).toBe("2026-06-16T00:00:00.000Z");
    expect(toISODate(date)).toBe("2026-06-16");
  });

  it("startOfWeek returns Monday for a mid-week UTC date", () => {
    const monday = startOfWeek(parseISODate("2026-06-17"));
    expect(toISODate(monday)).toBe("2026-06-15");
  });

  it("weekDates returns seven consecutive ISO days", () => {
    expect(weekDates("2026-06-15")).toEqual([
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
    ]);
  });

  it("getISOWeek matches calendar week for UTC date", () => {
    expect(getISOWeek(parseISODate("2026-06-15"))).toBe(25);
  });
});
