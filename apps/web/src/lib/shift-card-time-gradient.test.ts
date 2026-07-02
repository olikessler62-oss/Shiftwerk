import { describe, expect, it } from "vitest";
import {
  buildShiftCardGradientStops,
  buildShiftCardTimeGradientCss,
  parseClockTimeToMinutes,
  SHIFT_CARD_TIME_GRADIENT_ENABLED,
} from "@schichtwerk/ui-tokens";

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

    const gradientCss = buildShiftCardTimeGradientCss("08:00", "17:00");
    if (SHIFT_CARD_TIME_GRADIENT_ENABLED) {
      expect(gradientCss).toContain("linear-gradient(to right");
      expect(gradientCss).not.toContain("#ffffff");
    } else {
      expect(gradientCss).toContain("#ffffff");
    }
  });

  it("uses employee tint when time gradient is disabled", () => {
    if (SHIFT_CARD_TIME_GRADIENT_ENABLED) return;

    const gradientCss = buildShiftCardTimeGradientCss(
      "08:00",
      "17:00",
      undefined,
      "#3B82F6"
    );
    expect(gradientCss).toContain("linear-gradient(to bottom");
    expect(gradientCss).not.toContain("#ffffff");
  });

  it("handles overnight shifts", () => {
    const stops = buildShiftCardGradientStops("22:00", "06:00");
    expect(stops.length).toBeGreaterThan(2);
    expect(
      stops.slice(0, -1).reduce((sum, stop) => sum + stop.durationMinutes, 0)
    ).toBe(8 * 60);
  });
});
