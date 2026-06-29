import { describe, expect, it } from "vitest";
import {
  dayCardAreaRowsMinHeightRem,
  dayCardMinHeightRem,
} from "./dashboard-day-card-layout";

describe("dayCardAreaRowsMinHeightRem", () => {
  it("returns compact height for empty area list", () => {
    expect(dayCardAreaRowsMinHeightRem(0)).toBe(1.25);
  });

  it("grows linearly with area count", () => {
    expect(dayCardAreaRowsMinHeightRem(1)).toBe(1.25);
    expect(dayCardAreaRowsMinHeightRem(3)).toBe(4.75);
    expect(dayCardAreaRowsMinHeightRem(5)).toBe(8.25);
  });
});

describe("dayCardMinHeightRem", () => {
  it("matches minimum for three work sites including footer gap", () => {
    expect(dayCardMinHeightRem(3)).toBe(13.875);
  });

  it("increases with more work sites", () => {
    expect(dayCardMinHeightRem(5)).toBeGreaterThan(dayCardMinHeightRem(3));
    expect(dayCardMinHeightRem(1)).toBeLessThan(dayCardMinHeightRem(3));
  });
});
