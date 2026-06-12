import { describe, expect, it } from "vitest";
import { GERMANY_COMPLIANCE } from "./presets/germany";
import { getBreakRuleFromCompliance, resolveBreakTier } from "./rules";
import { getRule } from "./helpers";

describe("getBreakRuleFromCompliance (DE)", () => {
  it("requires no break up to 6 hours", () => {
    expect(getBreakRuleFromCompliance(GERMANY_COMPLIANCE, 6)).toEqual({
      kind: "none",
      minutes: 0,
    });
  });

  it("requires 30 minutes after more than 6 hours", () => {
    expect(getBreakRuleFromCompliance(GERMANY_COMPLIANCE, 6.5)).toEqual({
      kind: "required",
      minutes: 30,
      minSegmentMinutes: 15,
    });
  });

  it("requires 45 minutes from 9 hours", () => {
    expect(getBreakRuleFromCompliance(GERMANY_COMPLIANCE, 9)).toEqual({
      kind: "required",
      minutes: 45,
      minSegmentMinutes: 15,
    });
  });
});

describe("resolveBreakTier boundaries", () => {
  const rule = getRule(GERMANY_COMPLIANCE, "break_duration_tiers", "break_requirements")!;

  it("uses upper open tier at exactly 9 hours", () => {
    expect(resolveBreakTier(rule, 9).minutes).toBe(45);
  });

  it("uses middle tier below 9 hours", () => {
    expect(resolveBreakTier(rule, 8.99).minutes).toBe(30);
  });
});

describe("loadCompliancePreset", () => {
  it("loads Germany by ISO code", async () => {
    const { loadCompliancePreset } = await import("./presets");
    expect(loadCompliancePreset("DE").meta.jurisdiction).toBe("Deutschland");
  });
});
