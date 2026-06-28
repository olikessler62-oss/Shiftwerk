import { describe, expect, it } from "vitest";
import {
  formatDashboardAreaCardDayDate,
  formatDashboardAreaCardWeekRange,
  resolveDashboardAreaCardScopeDateLabel,
} from "./dashboard-area-card-scope-label";

describe("dashboard-area-card-scope-label", () => {
  it("formats a single day for area card headers", () => {
    expect(formatDashboardAreaCardDayDate("2026-06-22", "de")).toBe("Mo. 22. Jun");
    expect(formatDashboardAreaCardDayDate("2026-06-22", "en-GB")).toBe("Mon 22. Jun");
  });

  it("formats a week range for area card headers", () => {
    expect(formatDashboardAreaCardWeekRange("2026-06-22", "de")).toBe(
      "22. Jun - 28.Jun"
    );
  });

  it("resolves day and week labels for the active scope", () => {
    expect(
      resolveDashboardAreaCardScopeDateLabel(
        "day",
        "2026-06-22",
        "2026-06-22",
        "de"
      )
    ).toBe("Mo. 22. Jun");
    expect(
      resolveDashboardAreaCardScopeDateLabel(
        "week",
        "2026-06-22",
        "2026-06-22",
        "de"
      )
    ).toBe("22. Jun - 28.Jun");
  });
});
