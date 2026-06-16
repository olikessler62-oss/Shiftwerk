import { describe, expect, it } from "vitest";
import {
  computeCollapsedOvernightSpanLeftPxFromDayIndices,
  measureCollapsedOvernightSpanGeometry,
  measureExpandedOvernightSpanGeometry,
  planningOvernightDayCellsLookAdjacent,
  PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,
} from "./planning-overnight-span-layout";

describe("PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX", () => {
  it("is 6px", () => {
    expect(PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX).toBe(6);
  });
});

describe("measureOvernightSpanGeometry", () => {
  it("spans from start-day midpoint to end-day midpoint when expanded", () => {
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

    const geometry = measureExpandedOvernightSpanGeometry(
      startCellRect,
      endCellRect,
      overlayRect
    );
    expect(geometry.leftPx).toBe(50);
    expect(geometry.widthPx).toBe(100);
  });

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

    const collapsed = measureCollapsedOvernightSpanGeometry(
      startCellRect,
      endCellRect,
      overlayRect
    );
    expect(collapsed.widthPx).toBe(6);
    expect(collapsed.leftPx).toBe(97);
  });

  it("uses custom marker width when collapsed", () => {
    const overlayRect = { left: 0, top: 0, width: 80, height: 52 } as DOMRect;
    const startCellRect = {
      left: 0,
      right: 40,
      width: 40,
      top: 0,
      height: 52,
    } as DOMRect;
    const endCellRect = {
      left: 40,
      right: 80,
      width: 40,
      top: 0,
      height: 52,
    } as DOMRect;

    const collapsed = measureCollapsedOvernightSpanGeometry(
      startCellRect,
      endCellRect,
      overlayRect,
      4
    );
    expect(collapsed.widthPx).toBe(4);
    expect(collapsed.leftPx).toBe(38);
  });
});

describe("planningOvernightDayCellsLookAdjacent", () => {
  it("accepts touching day cells", () => {
    expect(
      planningOvernightDayCellsLookAdjacent(
        { left: 0, right: 40, width: 40 } as DOMRect,
        { left: 40, right: 80, width: 40 } as DOMRect
      )
    ).toBe(true);
  });

  it("rejects cells far apart during layout animation", () => {
    expect(
      planningOvernightDayCellsLookAdjacent(
        { left: 0, right: 40, width: 40 } as DOMRect,
        { left: 600, right: 640, width: 40 } as DOMRect
      )
    ).toBe(false);
  });
});

describe("computeCollapsedOvernightSpanLeftPxFromDayIndices", () => {
  it("places marker center on day border for equal columns", () => {
    expect(
      computeCollapsedOvernightSpanLeftPxFromDayIndices(300, 3, 0, 6)
    ).toBe(97);
    expect(
      computeCollapsedOvernightSpanLeftPxFromDayIndices(300, 3, 1, 6)
    ).toBe(197);
  });
});
