import { describe, expect, it } from "vitest";
import {
  computeDashboardExpandedOvernightSpanGeometry,
  dashboardTimeOffsetInCellPx,
  DASHBOARD_CELL_PADDING_PX,
  measureDashboardCollapsedOvernightSpanGeometry,
  DASHBOARD_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,
} from "./dashboard-overnight-span-layout";
import {
  DASHBOARD_CELL_DIVISION_DAY_END_MIN,
  resolveDashboardAreaServiceDayTimeline,
  resolveDashboardOvernightEndDayTimeline,
} from "./dashboard-service-day-timeline";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";

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

const timeline0800To2359: ShiftCardServiceTimeline = {
  startMin: 8 * 60,
  endMin: DASHBOARD_CELL_DIVISION_DAY_END_MIN,
  durationMin: DASHBOARD_CELL_DIVISION_DAY_END_MIN - 8 * 60,
  usesFullDay: false,
};

describe("computeDashboardExpandedOvernightSpanGeometry", () => {
  const overlayRect = { left: 0, top: 0, width: 400, height: 52 } as DOMRect;
  const startCellRect = {
    left: 0,
    right: 200,
    width: 200,
    top: 0,
    height: 52,
  } as DOMRect;
  const endCellRect = {
    left: 200,
    right: 400,
    width: 200,
    top: 0,
    height: 52,
  } as DOMRect;

  it("spans from start-day start time to end-day end time on service timelines", () => {
    const startDayServiceSpanMin = DASHBOARD_CELL_DIVISION_DAY_END_MIN - 8 * 60;
    const endDayServiceSpanMin = 10 * 60;
    const endTimeline: ShiftCardServiceTimeline = {
      startMin: 0,
      endMin: 18 * 60,
      durationMin: 18 * 60,
      usesFullDay: false,
    };

    const geometry = computeDashboardExpandedOvernightSpanGeometry(
      startCellRect,
      endCellRect,
      overlayRect,
      {
        startTime: "22:00",
        endTime: "06:00",
        startTimeline: timeline0800To2359,
        endTimeline,
        startDayServiceSpanMin,
        endDayServiceSpanMin,
      }
    );

    const startContentWidthPx = startCellRect.width - DASHBOARD_CELL_PADDING_PX * 2;
    const endContentWidthPx = endCellRect.width - DASHBOARD_CELL_PADDING_PX * 2;
    const startOffset = dashboardTimeOffsetInCellPx(
      "22:00",
      startContentWidthPx,
      timeline0800To2359
    );
    const endOffset = dashboardTimeOffsetInCellPx(
      "06:00",
      endContentWidthPx,
      endTimeline
    );
    const expectedWidth =
      endCellRect.left +
      DASHBOARD_CELL_PADDING_PX +
      endOffset -
      (startCellRect.left + DASHBOARD_CELL_PADDING_PX + startOffset);

    expect(geometry.leftPx).toBeCloseTo(
      DASHBOARD_CELL_PADDING_PX + startOffset,
      0
    );
    expect(geometry.widthPx).toBeCloseTo(expectedWidth, 0);
    expect(geometry.widthPx).toBeLessThan(((8 * 60) / (24 * 60)) * 400);
  });

  it("shortens the follow-up day tail for 22:00–04:00 vs 24h fraction", () => {
    const startTimeline = resolveDashboardAreaServiceDayTimeline(
      TUESDAY_HOURS,
      AREA_ID,
      "2026-06-17"
    );
    const endTimeline = resolveDashboardOvernightEndDayTimeline(
      WEDNESDAY_HOURS,
      AREA_ID,
      "2026-06-18"
    );

    const geometry = computeDashboardExpandedOvernightSpanGeometry(
      startCellRect,
      endCellRect,
      overlayRect,
      {
        startTime: "22:00",
        endTime: "04:00",
        startTimeline,
        endTimeline,
        startDayServiceSpanMin:
          DASHBOARD_CELL_DIVISION_DAY_END_MIN - 8 * 60,
        endDayServiceSpanMin: 18 * 60 - 8 * 60,
      }
    );

    const widthFrom24hFraction = ((6 * 60) / (24 * 60)) * 400;
    expect(geometry.widthPx).toBeLessThan(widthFrom24hFraction);
  });
});

describe("measureDashboardCollapsedOvernightSpanGeometry", () => {
  it("centers a 6px bar on the day border when collapsed", () => {
    const overlayRect = { left: 100, top: 0, width: 300, height: 52 } as DOMRect;
    const startCellRect = {
      left: 100,
      right: 200,
      width: 100,
      top: 0,
      height: 52,
    } as DOMRect;
    const endCellRect = {
      left: 200,
      right: 300,
      width: 100,
      top: 0,
      height: 52,
    } as DOMRect;

    const collapsed = measureDashboardCollapsedOvernightSpanGeometry(
      startCellRect,
      endCellRect,
      overlayRect
    );
    expect(collapsed.widthPx).toBe(DASHBOARD_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX);
    expect(collapsed.leftPx).toBe(97);
  });
});
