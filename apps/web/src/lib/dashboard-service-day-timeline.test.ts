import { describe, expect, it } from "vitest";
import {
  dashboardEndDayServiceSpanMinutesForOvernightWidth,
  dashboardOvernightShiftDurationMinutes,
  dashboardStartDayServiceSpanMinutesForOvernightWidth,
  DASHBOARD_CELL_DIVISION_DAY_END_MIN,
  resolveDashboardAreaServiceDayTimeline,
} from "./dashboard-service-day-timeline";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import { timelineLeftPx } from "@/lib/shift-card-service-timeline";

const AREA_ID = "restaurant";

const TUESDAY_HOURS: AreaServiceHourRef[] = [
  {
    id: "1",
    location_area_id: AREA_ID,
    weekday: 1,
    start_time: "08:00",
    end_time: "10:00",
  },
  {
    id: "2",
    location_area_id: AREA_ID,
    weekday: 1,
    start_time: "12:00",
    end_time: "15:00",
  },
  {
    id: "3",
    location_area_id: AREA_ID,
    weekday: 1,
    start_time: "18:00",
    end_time: "22:00",
  },
  {
    id: "4",
    location_area_id: AREA_ID,
    weekday: 1,
    start_time: "22:00",
    end_time: "04:00",
  },
];

const WEDNESDAY_HOURS: AreaServiceHourRef[] = [
  {
    id: "5",
    location_area_id: AREA_ID,
    weekday: 2,
    start_time: "08:00",
    end_time: "12:00",
  },
  {
    id: "6",
    location_area_id: AREA_ID,
    weekday: 2,
    start_time: "15:00",
    end_time: "18:00",
  },
  {
    id: "7",
    location_area_id: AREA_ID,
    weekday: 2,
    start_time: "22:00",
    end_time: "04:00",
  },
];

describe("resolveDashboardAreaServiceDayTimeline", () => {
  it("caps overnight service entries at 23:59 for cell division", () => {
    const timeline = resolveDashboardAreaServiceDayTimeline(
      TUESDAY_HOURS,
      AREA_ID,
      "2026-06-16"
    );

    expect(timeline.usesFullDay).toBe(false);
    expect(timeline.startMin).toBe(8 * 60);
    expect(timeline.endMin).toBe(DASHBOARD_CELL_DIVISION_DAY_END_MIN);
    expect(timeline.durationMin).toBe(DASHBOARD_CELL_DIVISION_DAY_END_MIN - 8 * 60);
  });

  it("does not start the follow-up day at midnight because of overnight spillover", () => {
    const timeline = resolveDashboardAreaServiceDayTimeline(
      WEDNESDAY_HOURS,
      AREA_ID,
      "2026-06-17"
    );

    expect(timeline.startMin).toBe(8 * 60);
    expect(timeline.endMin).toBe(DASHBOARD_CELL_DIVISION_DAY_END_MIN);
  });

  it("places 22:00 near the end of the start-day track", () => {
    const timeline = resolveDashboardAreaServiceDayTimeline(
      TUESDAY_HOURS,
      AREA_ID,
      "2026-06-16"
    );
    const leftPx = timelineLeftPx("22:00", 240, timeline, 4);
    expect(leftPx).toBeGreaterThan(200);
  });
});

describe("overnight width service spans", () => {
  it("uses earliest start to 23:59 on the start day", () => {
    expect(
      dashboardStartDayServiceSpanMinutesForOvernightWidth(
        TUESDAY_HOURS,
        AREA_ID,
        "2026-06-16"
      )
    ).toBe(DASHBOARD_CELL_DIVISION_DAY_END_MIN - 8 * 60);
  });

  it("uses earliest start to latest capped end on the follow-up day", () => {
    expect(
      dashboardEndDayServiceSpanMinutesForOvernightWidth(
        WEDNESDAY_HOURS,
        AREA_ID,
        "2026-06-17"
      )
    ).toBe(18 * 60 - 8 * 60);
  });

  it("computes overnight shift duration across midnight", () => {
    expect(dashboardOvernightShiftDurationMinutes("22:00", "04:00")).toBe(6 * 60);
    expect(dashboardOvernightShiftDurationMinutes("22:00", "06:00")).toBe(8 * 60);
  });

  it("matches the documented 8h shift on 26h service example", () => {
    const startSpan = dashboardStartDayServiceSpanMinutesForOvernightWidth(
      [
        {
          id: "d1a",
          location_area_id: AREA_ID,
          weekday: 0,
          start_time: "08:00",
          end_time: "17:00",
        },
        {
          id: "d1b",
          location_area_id: AREA_ID,
          weekday: 0,
          start_time: "22:00",
          end_time: "04:00",
        },
      ],
      AREA_ID,
      "2026-06-01"
    );
    const endSpan = dashboardEndDayServiceSpanMinutesForOvernightWidth(
      [
        {
          id: "d2a",
          location_area_id: AREA_ID,
          weekday: 1,
          start_time: "08:00",
          end_time: "12:00",
        },
        {
          id: "d2b",
          location_area_id: AREA_ID,
          weekday: 1,
          start_time: "15:00",
          end_time: "18:00",
        },
        {
          id: "d2c",
          location_area_id: AREA_ID,
          weekday: 1,
          start_time: "22:00",
          end_time: "04:00",
        },
      ],
      AREA_ID,
      "2026-06-02"
    );
    const shiftMin = dashboardOvernightShiftDurationMinutes("22:00", "06:00");
    const totalMin = startSpan + endSpan;

    expect(totalMin / 60).toBeCloseTo(26, 0);
    expect(shiftMin / totalMin).toBeCloseTo(8 / 26, 2);
  });
});
