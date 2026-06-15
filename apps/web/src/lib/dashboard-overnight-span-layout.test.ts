import { describe, expect, it } from "vitest";
import {
  computeDashboardExpandedOvernightSpanGeometry,
  dashboardTimeOffsetInCellPx,
  measureDashboardCollapsedOvernightSpanGeometry,
  DASHBOARD_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,
} from "./dashboard-overnight-span-layout";
import {
  DASHBOARD_CELL_DIVISION_DAY_END_MIN,
  dashboardOvernightShiftDurationMinutes,
} from "./dashboard-service-day-timeline";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";

const timeline0800To2359: ShiftCardServiceTimeline = {
  startMin: 8 * 60,
  endMin: DASHBOARD_CELL_DIVISION_DAY_END_MIN,
  durationMin: DASHBOARD_CELL_DIVISION_DAY_END_MIN - 8 * 60,
  usesFullDay: false,
};

describe("computeDashboardExpandedOvernightSpanGeometry", () => {
  it("keeps start position on the start-day timeline and scales width by service-hour share", () => {
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

    const startDayServiceSpanMin = DASHBOARD_CELL_DIVISION_DAY_END_MIN - 8 * 60;
    const endDayServiceSpanMin = 10 * 60;
    const shiftDurationMin = dashboardOvernightShiftDurationMinutes(
      "22:00",
      "06:00"
    );

    const geometry = computeDashboardExpandedOvernightSpanGeometry(
      startCellRect,
      endCellRect,
      overlayRect,
      {
        startTime: "22:00",
        endTime: "06:00",
        startTimeline: timeline0800To2359,
        startDayServiceSpanMin,
        endDayServiceSpanMin,
      }
    );

    const startOffset = dashboardTimeOffsetInCellPx(
      "22:00",
      184,
      timeline0800To2359
    );
    const expectedWidth =
      (shiftDurationMin / (startDayServiceSpanMin + endDayServiceSpanMin)) *
      400;

    expect(geometry.leftPx).toBeCloseTo(8 + startOffset, 0);
    expect(geometry.widthPx).toBeCloseTo(expectedWidth, 0);
    expect(shiftDurationMin / (startDayServiceSpanMin + endDayServiceSpanMin)).toBeCloseTo(
      8 / 26,
      2
    );
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
