import { describe, expect, it } from "vitest";
import {
  computeCollapsedDayShiftLineLayouts,
  computeCollapsedShiftLineLayout,
  computeCollapsedShiftPixelLeftPx,
  computePastDayUniformLineWidthPx,
  computeShiftCardCellLayout,
  sparseCellFairShareWidthPx,
} from "./shift-card-cell-layout";
import {
  createServiceTimelineHourGridStyle,
  resolveAreaServiceDayTimeline,
  resolveLocationServiceDayTimeline,
  serviceTimelineHourSegmentCount,
  timelineDurationWidthPx,
  timelineLeftPx,
} from "./shift-card-service-timeline";
import {
  buildShiftCardDisplayContent,
  resolveShiftCardDensity,
  splitEmployeeDisplayName,
} from "./shift-card-display-content";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";

const SERVICE_HOURS: AreaServiceHourRef[] = [
  {
    id: "h1",
    location_area_id: "area-1",
    weekday: 0,
    start_time: "08:00",
    end_time: "20:00",
  },
];

const MULTI_AREA_SERVICE_HOURS: AreaServiceHourRef[] = [
  {
    id: "h-restaurant",
    location_area_id: "restaurant",
    weekday: 0,
    start_time: "08:00",
    end_time: "22:00",
  },
  {
    id: "h-kitchen",
    location_area_id: "kitchen",
    weekday: 0,
    start_time: "08:00",
    end_time: "10:00",
  },
  {
    id: "h-bar",
    location_area_id: "bar",
    weekday: 0,
    start_time: "18:00",
    end_time: "22:00",
  },
];

describe("shift-card-service-timeline", () => {
  it("uses service-hour envelope instead of 24h", () => {
    const timeline = resolveAreaServiceDayTimeline(
      SERVICE_HOURS,
      "area-1",
      "2026-06-01"
    );
    expect(timeline.usesFullDay).toBe(false);
    expect(timeline.durationMin).toBe(12 * 60);

    expect(timelineLeftPx("08:00", 240, timeline, 4)).toBeCloseTo(4, 0);
    expect(timelineLeftPx("14:00", 240, timeline, 4)).toBeCloseTo(124, 0);
    expect(timelineDurationWidthPx("08:00", "10:00", 240, timeline)).toBeCloseTo(
      40,
      0
    );
  });

  it("falls back to full day without service hours", () => {
    const timeline = resolveAreaServiceDayTimeline(
      SERVICE_HOURS,
      "area-2",
      "2026-06-01"
    );
    expect(timeline.usesFullDay).toBe(true);
    expect(timeline.durationMin).toBe(24 * 60);
  });

  it("builds location-wide timeline from all areas on a date", () => {
    const timeline = resolveLocationServiceDayTimeline(
      MULTI_AREA_SERVICE_HOURS,
      "2026-06-01"
    );
    expect(timeline.usesFullDay).toBe(false);
    expect(timeline.durationMin).toBe(14 * 60);
    expect(serviceTimelineHourSegmentCount(timeline)).toBe(14);
    expect(createServiceTimelineHourGridStyle(timeline, 35).backgroundImage).toContain(
      "100% / 14"
    );
  });
});

describe("shift-card-cell-layout", () => {
  it("prefers timeline duration width when enough horizontal space exists", () => {
    const timeline = resolveAreaServiceDayTimeline(
      SERVICE_HOURS,
      "area-1",
      "2026-06-01"
    );
    const layout = computeShiftCardCellLayout(
      400,
      "08:00",
      "10:00",
      timeline,
      "compact",
      152
    );
    const durationWidth = timelineDurationWidthPx(
      "08:00",
      "10:00",
      400 - 8,
      timeline
    );
    expect(layout.widthPx).toBeGreaterThanOrEqual(durationWidth);
    expect(layout.widthPx).toBeLessThanOrEqual(400 - 8);
    expect(layout.marginLeftPx).toBeCloseTo(4, 0);
  });

  it("offsets later shifts to the right on the timeline", () => {
    const timeline = resolveAreaServiceDayTimeline(
      SERVICE_HOURS,
      "area-1",
      "2026-06-01"
    );
    const morning = computeShiftCardCellLayout(
      400,
      "08:00",
      "10:00",
      timeline,
      "compact",
      120,
      { shiftCountInCell: 3 }
    );
    const lunch = computeShiftCardCellLayout(
      400,
      "12:00",
      "15:00",
      timeline,
      "compact",
      120,
      { shiftCountInCell: 3 }
    );

    expect(lunch.marginLeftPx).toBeGreaterThan(morning.marginLeftPx + 40);
    expect(lunch.widthPx).toBeGreaterThanOrEqual(morning.widthPx);
  });

  it("uses fair-share width when only a few shifts exist in a wide cell", () => {
    const trackWidthPx = 392;
    expect(sparseCellFairShareWidthPx(trackWidthPx, 1)).toBeCloseTo(
      trackWidthPx * 0.78,
      0
    );
    expect(sparseCellFairShareWidthPx(trackWidthPx, 3)).toBeCloseTo(
      trackWidthPx * (0.92 / 3),
      0
    );

    const timeline = resolveAreaServiceDayTimeline(
      SERVICE_HOURS,
      "area-1",
      "2026-06-01"
    );
    const sparse = computeShiftCardCellLayout(
      400,
      "08:00",
      "10:00",
      timeline,
      "compact",
      72,
      { shiftCountInCell: 3 }
    );
    const dense = computeShiftCardCellLayout(
      400,
      "08:00",
      "10:00",
      timeline,
      "compact",
      72,
      { shiftCountInCell: 8 }
    );

    expect(sparse.widthPx).toBeGreaterThan(dense.widthPx);
  });

  it("uses marker width for marker density", () => {
    const timeline = resolveAreaServiceDayTimeline(
      SERVICE_HOURS,
      "area-1",
      "2026-06-01"
    );
    const layout = computeShiftCardCellLayout(
      400,
      "08:00",
      "17:00",
      timeline,
      "marker",
      0
    );
    expect(layout.widthPx).toBe(6 + 1);
    expect(layout.density).toBe("marker");
  });

  it("positions collapsed-day preview lines on the service timeline", () => {
    const timeline = resolveAreaServiceDayTimeline(
      SERVICE_HOURS,
      "area-1",
      "2026-06-01"
    );
    const layouts = computeCollapsedDayShiftLineLayouts(
      120,
      [
        { startTime: "08:00", endTime: "10:00" },
        { startTime: "12:00", endTime: "15:00" },
      ],
      timeline,
      31
    );

    expect(layouts).toHaveLength(2);
    expect(layouts[1]!.marginLeftPx).toBeGreaterThan(layouts[0]!.marginLeftPx);
    expect(layouts[1]!.widthPx).toBeGreaterThan(layouts[0]!.widthPx);
  });

  it("uses the smallest duration width for past collapsed-day preview lines only", () => {
    const timeline = resolveAreaServiceDayTimeline(
      SERVICE_HOURS,
      "area-1",
      "2026-06-01"
    );
    const shortOnly = computeCollapsedShiftLineLayout(
      120,
      "08:00",
      "09:00",
      timeline,
      31
    );
    const dayMinWidth = computePastDayUniformLineWidthPx(
      120,
      [
        { startTime: "08:00", endTime: "09:00" },
        { startTime: "12:00", endTime: "17:00" },
      ],
      timeline
    );
    const pastLayouts = computeCollapsedDayShiftLineLayouts(
      120,
      [{ startTime: "12:00", endTime: "17:00" }],
      timeline,
      31,
      { uniformMinWidth: true, uniformWidthPx: dayMinWidth }
    );
    const activeLayouts = computeCollapsedDayShiftLineLayouts(
      120,
      [
        { startTime: "08:00", endTime: "09:00" },
        { startTime: "12:00", endTime: "17:00" },
      ],
      timeline,
      31,
      { uniformMinWidth: false }
    );

    expect(dayMinWidth).toBe(shortOnly.widthPx);
    expect(pastLayouts[0]!.widthPx).toBe(dayMinWidth);
    expect(activeLayouts[0]!.widthPx).toBeLessThan(activeLayouts[1]!.widthPx);
  });

  it("positions collapsed-area preview pixels on the service timeline", () => {
    const timeline = resolveAreaServiceDayTimeline(
      SERVICE_HOURS,
      "area-1",
      "2026-06-01"
    );
    const morning = computeCollapsedShiftPixelLeftPx(120, "08:00", timeline);
    const lunch = computeCollapsedShiftPixelLeftPx(120, "12:00", timeline);

    expect(lunch).toBeGreaterThan(morning);
  });

  it("renders equal widths for equal shift times across areas on location timeline", () => {
    const locationTimeline = resolveLocationServiceDayTimeline(
      MULTI_AREA_SERVICE_HOURS,
      "2026-06-01"
    );
    const kitchenTimeline = resolveAreaServiceDayTimeline(
      MULTI_AREA_SERVICE_HOURS,
      "kitchen",
      "2026-06-01"
    );

    const locationLayout = computeShiftCardCellLayout(
      400,
      "08:00",
      "10:00",
      locationTimeline,
      "compact",
      72,
      { shiftCountInCell: 2, uniformShiftDurationWidth: true }
    );
    const kitchenLayout = computeShiftCardCellLayout(
      400,
      "08:00",
      "10:00",
      kitchenTimeline,
      "compact",
      72,
      { shiftCountInCell: 2 }
    );

    expect(locationLayout.widthPx).toBeLessThan(kitchenLayout.widthPx);
    expect(locationLayout.marginLeftPx).toBeCloseTo(
      computeShiftCardCellLayout(
        400,
        "08:00",
        "10:00",
        locationTimeline,
        "compact",
        72,
        { shiftCountInCell: 12, uniformShiftDurationWidth: true }
      ).marginLeftPx,
      0
    );
    expect(
      computeShiftCardCellLayout(
        400,
        "08:00",
        "10:00",
        locationTimeline,
        "compact",
        72,
        { shiftCountInCell: 12, uniformShiftDurationWidth: true }
      ).widthPx
    ).toBe(locationLayout.widthPx);
    expect(kitchenLayout.widthPx).toBeGreaterThan(locationLayout.widthPx);
  });
});

describe("shift-card-display-content", () => {
  it("splits employee names", () => {
    expect(splitEmployeeDisplayName("Max Mustermann")).toEqual({
      firstName: "Max",
      lastName: "Mustermann",
    });
  });

  it("uses shorter secondary label in compact mode", () => {
    const withShortShift = buildShiftCardDisplayContent(
      {
        employeeName: "Max Mustermann",
        startTime: "08:00",
        endTime: "16:00",
        shiftName: "Früh",
      },
      ""
    );
    expect(withShortShift.line1Secondary).toBe("Früh");
    expect(withShortShift.shiftLabel).toBe("Früh");
  });

  it("builds two-line content with jobs", () => {
    const display = buildShiftCardDisplayContent(
      {
        employeeName: "Max Mustermann",
        startTime: "08:00",
        endTime: "17:00",
        shiftName: "Früh",
      },
      "Koch, Bar"
    );
    expect(display.firstName).toBe("Max");
    expect(display.lastName).toBe("Mustermann");
    expect(display.jobsLabel).toBe("Koch, Bar");
    expect(display.tooltipBody).toContain("Koch, Bar");
  });

  it("chooses density based on cell width", () => {
    expect(resolveShiftCardDensity(400, 152, 100)).toBe("two-line");
    expect(resolveShiftCardDensity(120, 152, 100)).toBe("compact");
    expect(resolveShiftCardDensity(48, 152, 100)).toBe("marker");
  });
});
