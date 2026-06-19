import { describe, expect, it } from "vitest";
import { getAreaCalendarWeekHeaderParts } from "./planning-utils";

describe("getAreaCalendarWeekHeaderParts", () => {
  it("shows a single month and year within one calendar year", () => {
    const parts = getAreaCalendarWeekHeaderParts("2026-06-08", "de-DE");

    expect(parts.monthYearLabel).toBe("Juni 2026");
    expect(parts.calendarWeek).toBe(24);
  });

  it("shows both month/year labels when the week spans two years", () => {
    const parts = getAreaCalendarWeekHeaderParts("2026-12-28", "de-DE");

    expect(parts.monthYearLabel).toBe("Dezember 2026/Januar 2027");
    expect(parts.calendarWeek).toBe(53);
  });

  it("shows both months with a shared year when the week spans two months", () => {
    const parts = getAreaCalendarWeekHeaderParts("2026-11-30", "de-DE");

    expect(parts.monthYearLabel).toBe("November/Dezember 2026");
  });
});
