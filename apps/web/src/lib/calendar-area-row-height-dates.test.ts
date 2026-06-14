import { describe, expect, it } from "vitest";
import {
  isAreaRowMinimizedFromTodayThroughWeek,
  isCalendarAreaRowHeightDate,
} from "./calendar-area-row-height-dates";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";

const todayISO = "2026-06-10";
const weekDates = [
  "2026-06-08",
  "2026-06-09",
  "2026-06-10",
  "2026-06-11",
  "2026-06-12",
  "2026-06-13",
  "2026-06-14",
];

describe("calendar-area-row-height-dates", () => {
  it("isCalendarAreaRowHeightDate excludes past expanded days", () => {
    const active = new Set(["2026-06-09", "2026-06-13"]);
    expect(isCalendarAreaRowHeightDate("2026-06-09", active, todayISO)).toBe(
      false
    );
    expect(isCalendarAreaRowHeightDate("2026-06-13", active, todayISO)).toBe(
      true
    );
  });

  it("minimizes when no service and no shifts from today through week end", () => {
    expect(
      isAreaRowMinimizedFromTodayThroughWeek(
        [],
        "bar",
        weekDates,
        todayISO,
        () => 0
      )
    ).toBe(true);
  });

  it("does not minimize when service exists on a remainder day", () => {
    const serviceHours: AreaServiceHourRef[] = [
      {
        location_area_id: "bar",
        weekday: 5,
        start_time: "08:00",
        end_time: "12:00",
      },
    ];

    expect(
      isAreaRowMinimizedFromTodayThroughWeek(
        serviceHours,
        "bar",
        weekDates,
        todayISO,
        () => 0
      )
    ).toBe(false);
  });

  it("does not minimize when shifts exist on a collapsed remainder day", () => {
    expect(
      isAreaRowMinimizedFromTodayThroughWeek(
        [],
        "bar",
        weekDates,
        todayISO,
        (areaId, dateISO) => (dateISO === "2026-06-13" ? 3 : 0)
      )
    ).toBe(false);
  });

  it("does not minimize when shifts exist on a past day of the week", () => {
    expect(
      isAreaRowMinimizedFromTodayThroughWeek(
        [],
        "bar",
        weekDates,
        todayISO,
        (areaId, dateISO) => (dateISO === "2026-06-09" ? 2 : 0)
      )
    ).toBe(false);
  });

  it("does not minimize when viewing a past-only week", () => {
    const pastWeek = [
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ];

    expect(
      isAreaRowMinimizedFromTodayThroughWeek(
        [],
        "bar",
        pastWeek,
        todayISO,
        () => 0
      )
    ).toBe(false);
  });
});
