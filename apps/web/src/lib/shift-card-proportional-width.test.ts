import { describe, expect, it } from "vitest";
import {
  resolveOvernightSpanWidthPx,
  widthFrom24hDurationPx,
} from "./shift-card-proportional-width";

describe("widthFrom24hDurationPx", () => {
  it("maps duration linearly to reference width", () => {
    expect(widthFrom24hDurationPx(2 * 60, 240)).toBeCloseTo(20, 0);
    expect(widthFrom24hDurationPx(6 * 60, 400)).toBeCloseTo(100, 0);
  });
});

describe("resolveOvernightSpanWidthPx", () => {
  it("uses 24h fraction of combined cell width with minimum", () => {
    const width = resolveOvernightSpanWidthPx({
      startTime: "22:00",
      endTime: "04:00",
      combinedCellWidthPx: 400,
    });
    expect(width).toBeCloseTo(100, 0);
  });

  it("applies minimum readable width for very short spans", () => {
    const width = resolveOvernightSpanWidthPx({
      startTime: "23:30",
      endTime: "00:30",
      combinedCellWidthPx: 200,
    });
    expect(width).toBeGreaterThanOrEqual(96);
  });
});
