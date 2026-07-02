import { describe, expect, it } from "vitest";
import {
  buildShiftCardStripGradientCss,
  buildShiftCardSurfaceGradientCss,
} from "@schichtwerk/ui-tokens";

describe("shift-card-color-gradient", () => {
  it("builds a darker strip gradient from the base color", () => {
    const css = buildShiftCardStripGradientCss("#3B82F6");
    expect(css).toContain("linear-gradient(to bottom");
    expect(css).toContain("#3b82f6");
    expect(css).not.toMatch(/#3b82f6 0%, #3b82f6 100%/i);
  });

  it("builds a subtle tinted surface gradient", () => {
    const css = buildShiftCardSurfaceGradientCss("#16A34A");
    expect(css).toContain("linear-gradient(to bottom");
    expect(css).not.toContain("#ffffff");
  });

  it("passes through existing css gradients", () => {
    const gradient = "linear-gradient(90deg, #fff, #000)";
    expect(buildShiftCardStripGradientCss(gradient)).toBe(gradient);
    expect(buildShiftCardSurfaceGradientCss(gradient)).toBe(gradient);
  });
});
