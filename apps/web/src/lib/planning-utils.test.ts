import { describe, expect, it } from "vitest";
import { getAreaCalendarWeekHeaderParts } from "./planning-utils";

describe("getAreaCalendarWeekHeaderParts", () => {
  it("shows a single month and year within one calendar year", () => {
    const parts = getAreaCalendarWeekHeaderParts("2026-06-08", "de-DE");

    expect(parts.monthYearLabel).toBe("Juni 2026");
    expect(parts.rangeLabel).toBe("8. Juni – 14. Juni 2026");
    expect(parts.compactRangeLabel).toBe("08.06.-14.06.");
    expect(parts.calendarWeek).toBe(24);
  });

  it("shows both month/year labels when the week spans two years", () => {
    const parts = getAreaCalendarWeekHeaderParts("2026-12-28", "de-DE");

    expect(parts.monthYearLabel).toBe("Dezember 2026/Januar 2027");
    expect(parts.rangeLabel).toBe(
      "28. Dezember 2026 – 3. Januar 2027"
    );
    expect(parts.calendarWeek).toBe(53);
  });

  it("shows both months with a shared year when the week spans two months", () => {
    const parts = getAreaCalendarWeekHeaderParts("2026-11-30", "de-DE");

    expect(parts.monthYearLabel).toBe("November/Dezember 2026");
    expect(parts.rangeLabel).toBe("30. November – 6. Dezember 2026");
  });

  it("shows year on both ends when the week crosses a year boundary", () => {
    const parts = getAreaCalendarWeekHeaderParts("2026-12-29", "de-DE");

    expect(parts.rangeLabel).toBe(
      "29. Dezember 2026 – 4. Januar 2027"
    );
    expect(parts.compactRangeLabel).toBe("29.12.-04.01.27");
  });

  it("shows compact week range for mid-June week", () => {
    const parts = getAreaCalendarWeekHeaderParts("2026-06-22", "de-DE");

    expect(parts.compactRangeLabel).toBe("22.06.-28.06.");
  });
});
