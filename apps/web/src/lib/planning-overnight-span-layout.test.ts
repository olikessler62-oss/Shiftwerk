import { describe, expect, it } from "vitest";
import {
  measureCollapsedOvernightSpanGeometry,
  measureExpandedOvernightSpanGeometry,
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
});
