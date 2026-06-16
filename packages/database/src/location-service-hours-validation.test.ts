import { describe, expect, it } from "vitest";
import {
  isOvernightServiceHour,
  serviceHourIntervalsOverlap,
  shiftTimesWithinServiceHours,
  validateServiceHoursInput,
  validateShiftAgainstServiceHours,
} from "./location-service-hours-validation";

describe("validateServiceHoursInput", () => {
  it("accepts same-day windows", () => {
    const result = validateServiceHoursInput([
      { weekday: 1, start_time: "09:00", end_time: "17:00" },
    ]);
    expect(result.ok).toBe(true);
  });

  it("accepts overnight windows", () => {
    const result = validateServiceHoursInput([
      { weekday: 1, start_time: "21:00", end_time: "05:00" },
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects equal start and end times", () => {
    const result = validateServiceHoursInput([
      { weekday: 1, start_time: "09:00", end_time: "09:00" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects overlapping same-day windows", () => {
    const result = validateServiceHoursInput([
      { weekday: 1, start_time: "09:00", end_time: "14:00" },
      { weekday: 1, start_time: "13:00", end_time: "18:00" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects overnight spill overlapping next weekday morning", () => {
    const result = validateServiceHoursInput([
      { weekday: 1, start_time: "21:00", end_time: "05:00" },
      { weekday: 2, start_time: "04:00", end_time: "08:00" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("allows overnight and next-day afternoon windows", () => {
    const result = validateServiceHoursInput([
      { weekday: 1, start_time: "21:00", end_time: "05:00" },
      { weekday: 2, start_time: "09:00", end_time: "17:00" },
    ]);
    expect(result.ok).toBe(true);
  });

  it("allows adjacent same-day evening and overnight window on same weekday", () => {
    const rows = [
      { weekday: 0, start_time: "08:00", end_time: "10:00" },
      { weekday: 0, start_time: "12:00", end_time: "15:00" },
      { weekday: 0, start_time: "18:00", end_time: "22:00" },
      { weekday: 0, start_time: "22:00", end_time: "04:00" },
    ];
    const result = validateServiceHoursInput(rows);
    expect(result.ok).toBe(true);
  });

  it("allows restaurant-style windows on Mon-Wed with overnight", () => {
    const rows: { weekday: number; start_time: string; end_time: string }[] = [];
    for (const wd of [0, 1, 2, 3, 4, 5, 6]) {
      rows.push({ weekday: wd, start_time: "08:00", end_time: "10:00" });
      rows.push({ weekday: wd, start_time: "12:00", end_time: "15:00" });
      rows.push({ weekday: wd, start_time: "18:00", end_time: "22:00" });
    }
    for (const wd of [0, 1, 2]) {
      rows.push({ weekday: wd, start_time: "22:00", end_time: "04:00" });
    }
    const result = validateServiceHoursInput(rows);
    expect(result.ok).toBe(true);
  });

  it("allows consecutive overnight windows on adjacent weekdays", () => {
    const result = validateServiceHoursInput([
      { weekday: 0, start_time: "18:00", end_time: "22:00" },
      { weekday: 0, start_time: "22:00", end_time: "04:00" },
      { weekday: 1, start_time: "18:00", end_time: "22:00" },
      { weekday: 1, start_time: "22:00", end_time: "04:00" },
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("serviceHourIntervalsOverlap", () => {
  it("detects overlap within same weekday", () => {
    expect(
      serviceHourIntervalsOverlap(
        { weekday: 0, start_time: "22:00", end_time: "06:00" },
        { weekday: 0, start_time: "23:00", end_time: "23:30" }
      )
    ).toBe(true);
  });
});

describe("shiftTimesWithinServiceHours", () => {
  it("accepts same-day shift in same-day window", () => {
    expect(
      shiftTimesWithinServiceHours("10:00", "16:00", [
        { start_time: "09:00", end_time: "18:00" },
      ])
    ).toBe(true);
  });

  it("accepts overnight shift in overnight window", () => {
    expect(
      shiftTimesWithinServiceHours("22:00", "06:00", [
        { start_time: "21:00", end_time: "05:00" },
      ])
    ).toBe(false);
    expect(
      shiftTimesWithinServiceHours("22:00", "05:00", [
        { start_time: "21:00", end_time: "05:00" },
      ])
    ).toBe(true);
  });

  it("rejects shift outside window", () => {
    expect(
      shiftTimesWithinServiceHours("08:00", "12:00", [
        { start_time: "21:00", end_time: "05:00" },
      ])
    ).toBe(false);
  });
});

describe("validateShiftAgainstServiceHours overnight spill", () => {
  it("accepts morning shift on spill day from previous overnight service hour", () => {
    const result = validateShiftAgainstServiceHours(
      [
        {
          location_area_id: "area-1",
          weekday: 1,
          start_time: "22:00",
          end_time: "04:00",
        },
        {
          location_area_id: "area-1",
          weekday: 2,
          start_time: "08:00",
          end_time: "12:00",
        },
      ],
      "area-1",
      2,
      "00:00",
      "04:00"
    );
    expect(result).toEqual({ ok: true });
  });
});

describe("isOvernightServiceHour", () => {
  it("detects overnight windows", () => {
    expect(isOvernightServiceHour("21:00", "05:00")).toBe(true);
    expect(isOvernightServiceHour("09:00", "17:00")).toBe(false);
  });
});
