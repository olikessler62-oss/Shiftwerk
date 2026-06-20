import { describe, expect, it } from "vitest";
import { resolveDashboardShiftCardInlineStatusVisible } from "./dashboard-shift-card-inline-status";

describe("resolveDashboardShiftCardInlineStatusVisible", () => {
  it("shows inline status when first line and status fit beside each other", () => {
    expect(
      resolveDashboardShiftCardInlineStatusVisible({
        contentWidthPx: 180,
        templateName: "Früh",
        timeLabel: "08:00 – 16:00",
        statusLabel: "Status: Bestätigt",
        compact: false,
      })
    ).toBe(true);
  });

  it("hides inline status when card content is too narrow", () => {
    expect(
      resolveDashboardShiftCardInlineStatusVisible({
        contentWidthPx: 48,
        templateName: "Frühschicht Restaurant",
        timeLabel: "08:00 – 16:00",
        statusLabel: "Status: Bestätigung angefragt",
        compact: false,
      })
    ).toBe(false);
  });

  it("hides inline status when card text already overflows", () => {
    expect(
      resolveDashboardShiftCardInlineStatusVisible({
        contentWidthPx: 180,
        templateName: "Früh",
        timeLabel: "08:00 – 16:00",
        statusLabel: "Status: Bestätigt",
        compact: false,
        contentOverflows: true,
      })
    ).toBe(false);
  });
});
