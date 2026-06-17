import { describe, expect, it } from "vitest";
import {
  isOvernightShiftWindow,
  overnightShiftEndDateISO,
  shiftHoursOnCalendarDay,
  splitShiftWindowIntoCalendarDaySegments,
} from "./shift-day-segments";

describe("splitShiftWindowIntoCalendarDaySegments", () => {
  it("keeps same-day shift on one segment", () => {
    expect(
      splitShiftWindowIntoCalendarDaySegments({
        shiftDate: "2026-06-17",
        startTime: "08:00",
        endTime: "16:00",
      })
    ).toEqual([
      {
        dateISO: "2026-06-17",
        startTime: "08:00",
        endTime: "16:00",
        minutes: 480,
      },
    ]);
  });

  it("splits overnight shift at midnight", () => {
    expect(
      splitShiftWindowIntoCalendarDaySegments({
        shiftDate: "2026-06-17",
        startTime: "22:00",
        endTime: "04:00",
      })
    ).toEqual([
      {
        dateISO: "2026-06-17",
        startTime: "22:00",
        endTime: "24:00",
        minutes: 120,
      },
      {
        dateISO: "2026-06-18",
        startTime: "00:00",
        endTime: "04:00",
        minutes: 240,
      },
    ]);
  });
});

describe("shiftHoursOnCalendarDay", () => {
  it("attributes only the morning portion to the follow-up day", () => {
    const shift = {
      shiftDate: "2026-06-17",
      startTime: "22:00",
      endTime: "04:00",
    };
    expect(shiftHoursOnCalendarDay({ ...shift, calendarDate: "2026-06-17" })).toBe(
      2
    );
    expect(shiftHoursOnCalendarDay({ ...shift, calendarDate: "2026-06-18" })).toBe(
      4
    );
    expect(shiftHoursOnCalendarDay({ ...shift, calendarDate: "2026-06-19" })).toBe(
      0
    );
  });
});

describe("overnightShiftEndDateISO", () => {
  it("returns next day for overnight windows", () => {
    expect(isOvernightShiftWindow("22:00", "04:00")).toBe(true);
    expect(
      overnightShiftEndDateISO("2026-06-17", "22:00", "04:00")
    ).toBe("2026-06-18");
    expect(
      overnightShiftEndDateISO("2026-06-17", "08:00", "16:00")
    ).toBe("2026-06-17");
  });
});
