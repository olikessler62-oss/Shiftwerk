import { describe, expect, it } from "vitest";
import {
  buildShiftCardGradientStops,
  buildShiftCardTimeGradientCss,
  parseClockTimeToMinutes,
} from "./shift-card-time-gradient";

describe("shift-card-time-gradient", () => {
  it("parses clock times", () => {
    expect(parseClockTimeToMinutes("08:00")).toBe(8 * 60);
    expect(parseClockTimeToMinutes("17:30")).toBe(17 * 60 + 30);
  });

  it("builds proportional stops for 08:00–17:00 with dominant yellow", () => {
    const stops = buildShiftCardGradientStops("08:00", "17:00");
    const segments = stops.slice(0, -1);
    const totalMinutes = segments.reduce(
      (sum, stop) => sum + stop.durationMinutes,
      0
    );
    expect(totalMinutes).toBe(9 * 60);

    const yellowMinutes = segments
      .filter((stop) => stop.color[0] === 253 && stop.color[1] === 224)
      .reduce((sum, stop) => sum + stop.durationMinutes, 0);

    expect(yellowMinutes).toBeGreaterThan(totalMinutes * 0.5);
    expect(buildShiftCardTimeGradientCss("08:00", "17:00")).toContain(
      "linear-gradient(to right"
    );
  });

  it("handles overnight shifts", () => {
    const stops = buildShiftCardGradientStops("22:00", "06:00");
    expect(stops.length).toBeGreaterThan(2);
    expect(
      stops.slice(0, -1).reduce((sum, stop) => sum + stop.durationMinutes, 0)
    ).toBe(8 * 60);
  });
});
